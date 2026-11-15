import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";
import { getSupabaseClient } from "@/data";

const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping shell live Supabase probe: LIVE_DB=1 is not set.",
  );
}

describe("App shell bootstrap", () => {
  it("mounts App inside Ionic shell without console errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(<App />);

      expect(
        await screen.findByRole("heading", { name: "Maestro de Personal" }),
      ).toBeTruthy();
      expect(screen.getByText("Soluciones Móviles S.A.C.")).toBeTruthy();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("removes diagnostic /dev/* routes and keeps valid PWA metadata and icons", async () => {
    const appSource = readFileSync(
      resolve(process.cwd(), "src/App.tsx"),
      "utf8",
    );
    expect(appSource).not.toContain("/dev/");
    expect(appSource).not.toContain("diagnostics");

    const htmlSource = readFileSync(
      resolve(process.cwd(), "index.html"),
      "utf8",
    );
    expect(htmlSource).toContain("viewport-fit=cover");
    expect(htmlSource).toContain("/manifest.webmanifest");

    const manifestPath = resolve(process.cwd(), "public/manifest.webmanifest");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      name: "Maestro de Personal",
      short_name: "Personal",
      display: "standalone",
      start_url: ".",
    });
    expect(
      existsSync(resolve(process.cwd(), "public/icons/icon-192.png")),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), "public/icons/icon-512.png")),
    ).toBe(true);

    render(<App initialEntries={["/dev/feedback"]} />);
    expect(
      await screen.findByRole("heading", { name: "Maestro de Personal" }),
    ).toBeTruthy();
  });

  it.skipIf(!isLiveDb)(
    "verifies Supabase env configuration and pais head connectivity when LIVE_DB=1",
    async () => {
      const client = getSupabaseClient();
      const { error } = await client
        .from("pais")
        .select("PaiCod", { count: "exact", head: true });
      expect(error).toBeNull();
    },
  );
});
