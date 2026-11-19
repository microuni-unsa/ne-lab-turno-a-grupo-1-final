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
