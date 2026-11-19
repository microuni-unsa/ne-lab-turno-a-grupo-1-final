import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  EST_X,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core";
import {
  getTableOrdering,
  isTransportError,
  PaisRepo,
  PersonalRepo,
} from "@/data";

describe("Cumplimiento normativo global SPEC §3–§15", () => {
  it("verifica ordenamientos R18 en las 4 tablas", () => {
    expect(getTableOrdering(TABLE_PAIS, "default")).toEqual([
      { column: "PaiNom", ascending: true },
      { column: "PaiCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_PAIS, "alternate")).toEqual([
      { column: "PaiCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_DEPENDENCIA, "default")).toEqual([
      { column: "DepNom", ascending: true },
      { column: "DepCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_CARGO, "default")).toEqual([
      { column: "CarNom", ascending: true },
      { column: "CarCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_PERSONAL, "default")).toEqual([
      { column: "PerCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_PERSONAL, "alternate")).toEqual([
      { column: "PerNom", ascending: true },
      { column: "PerCod", ascending: true },
    ]);
  });

  it("propaga fallos de red/transporte PostgREST en guardar() sin confundirlos con E-TRANSITION", async () => {
    expect(
      isTransportError(
        { code: "", message: "TypeError: Failed to fetch", details: "" },
        0,
      ),
    ).toBe(true);
    expect(
      isTransportError({ code: "23505", message: "duplicate key" }, 409),
    ).toBe(false);

    const offlineClient = createClient(
      "https://offline-test.supabase.co",
      "sb_publishable_offline_test_key",
      {
        db: { retry: false },
        global: {
          fetch: () => Promise.reject(new TypeError("Failed to fetch")),
        },
      },
    );

    const paisRepo = new PaisRepo(offlineClient);
    await expect(
      paisRepo.guardar({ op: "insert", p_cod: "URY", p_nom: "Uruguay" }),
    ).rejects.toThrow(/Failed to fetch/);

    const personalRepo = new PersonalRepo(offlineClient);
    await expect(
      personalRepo.guardar({
        op: "set_state",
        p_cod: "EMP01",
        p_est: EST_X,
      }),
    ).rejects.toThrow(/Failed to fetch/);
  });
});
