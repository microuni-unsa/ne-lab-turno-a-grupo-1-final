import { describe, expect, it, vi } from "vitest";
import { EST_A, EST_I, EST_X, TABLE_CARGO, TABLE_PAIS } from "@/core";
import {
  createGselBinding,
  createGselLabelResolver,
  createGselQuerySource,
  type GselRepoContract,
} from "@/features/personal/gsel-source";

interface FakeRefRow {
  readonly PaiCod: number;
  readonly PaiNom: string;
  readonly PaiEstReg: number;
}

describe("createGselQuerySource y createGselLabelResolver (Fase 8 unit)", () => {
  it("ordena alfabéticamente Nom ASC, Cod ASC, excluye inactivos/eliminados e ignora filas inválidas", async () => {
    const repo: Pick<GselRepoContract<FakeRefRow>, "gsel"> = {
      async gsel() {
        return [
          { PaiCod: 20, PaiNom: "Centro", PaiEstReg: EST_A },
          { PaiCod: 1, PaiNom: "Perú", PaiEstReg: EST_A },
          { PaiCod: 3, PaiNom: "Colombia", PaiEstReg: EST_I },
          { PaiCod: 4, PaiNom: "Ecuador", PaiEstReg: EST_X },
          { PaiCod: 5, PaiNom: "Centro", PaiEstReg: EST_A },
          { PaiCod: 12, PaiNom: "Centro", PaiEstReg: EST_A },
          { PaiCod: -1, PaiNom: "Código inválido", PaiEstReg: EST_A },
          { PaiCod: 9, PaiNom: "   ", PaiEstReg: EST_A },
          { PaiCod: 2, PaiNom: "Chile", PaiEstReg: EST_A },
        ];
      },
    };

    const source = createGselQuerySource({
      table: TABLE_PAIS,
      repo,
      codeCol: "PaiCod",
      nomCol: "PaiNom",
      estCol: "PaiEstReg",
    });

    const all = await source.fetch({ search: "", page: 1, pageSize: 50 });
    expect(all.total).toBe(5);
    expect(all.items).toEqual([
      { key: "5", value: "5", label: "Centro" },
      { key: "12", value: "12", label: "Centro" },
      { key: "20", value: "20", label: "Centro" },
      { key: "2", value: "2", label: "Chile" },
      { key: "1", value: "1", label: "Perú" },
    ]);

    const filtered = await source.fetch({
      search: "  cen ",
      page: 1,
      pageSize: 50,
    });
    expect(filtered.total).toBe(3);
    expect(filtered.items.map((item) => item.value)).toEqual(["5", "12", "20"]);

    const paged = await source.fetch({ search: "", page: 2, pageSize: 2 });
    expect(paged.total).toBe(5);
    expect(paged.items.map((item) => item.value)).toEqual(["20", "2"]);
  });

  it("retorna { items: [], total: 0 } limpiamente cuando el catálogo activo está vacío (SPEC §9.2)", async () => {
    const repo: Pick<GselRepoContract<FakeRefRow>, "gsel"> = {
      async gsel() {
        return [];
      },
    };

    const source = createGselQuerySource({
      table: TABLE_CARGO,
      repo,
      codeCol: "CarCod",
      nomCol: "CarNom",
    });

    const result = await source.fetch({ search: "", page: 1, pageSize: 50 });
    expect(result).toEqual({ items: [], total: 0 });
  });

  it("resuelve etiquetas para filas activas e inactivas/eliminadas heredadas en Modificación (R7)", async () => {
    const getByCodeSpy = vi.fn(
      async (code: number): Promise<FakeRefRow | null> => {
        if (code === 3) {
          return { PaiCod: 3, PaiNom: "Colombia", PaiEstReg: EST_I };
        }
        if (code === 4) {
          return { PaiCod: 4, PaiNom: "Ecuador", PaiEstReg: EST_X };
        }
        return null;
      },
    );

    const repo: GselRepoContract<FakeRefRow> = {
      async gsel() {
        return [{ PaiCod: 1, PaiNom: "Perú", PaiEstReg: EST_A }];
      },
      getByCode: getByCodeSpy,
    };

    const resolver = createGselLabelResolver({
      table: TABLE_PAIS,
      repo,
      codeCol: "PaiCod",
      nomCol: "PaiNom",
      estCol: "PaiEstReg",
    });

    expect(await resolver(1)).toBe("Perú");
    expect(getByCodeSpy).not.toHaveBeenCalled();

    expect(await resolver(3)).toBe("Colombia (Inactivo)");
    expect(await resolver(4)).toBe("Ecuador (Eliminado)");
    expect(await resolver(999)).toBeUndefined();
    expect(await resolver("abc")).toBeUndefined();
  });

  it("createGselBinding entrega source y resolver compartidos sobre un mismo contrato", async () => {
    const repo: GselRepoContract<FakeRefRow> = {
      async gsel() {
        return [
          { PaiCod: 2, PaiNom: "Chile", PaiEstReg: EST_A },
          { PaiCod: 1, PaiNom: "Perú", PaiEstReg: EST_A },
        ];
      },
      async getByCode(code) {
        return code === 3
          ? { PaiCod: 3, PaiNom: "Colombia", PaiEstReg: EST_I }
          : null;
      },
    };

    const binding = createGselBinding({
      table: TABLE_PAIS,
      repo,
      codeCol: "PaiCod",
      nomCol: "PaiNom",
      estCol: "PaiEstReg",
    });

    const list = await binding.asyncSource.fetch({
      search: "",
      page: 1,
      pageSize: 20,
    });
    expect(list.items.map((item) => item.label)).toEqual(["Chile", "Perú"]);
    expect(await binding.resolveLabel("3")).toBe("Colombia (Inactivo)");
  });
});
