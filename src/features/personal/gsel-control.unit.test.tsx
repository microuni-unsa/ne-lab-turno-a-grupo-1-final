import { zodResolver } from "@hookform/resolvers/zod";
import { IonApp } from "@ionic/react";
import { createFormDefaults } from "@microx-technologies/microform";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  asPaiCod,
  EST_A,
  EST_I,
  EST_X,
  type PaisRow,
  TABLE_PAIS,
} from "@/core";
import {
  createGselBinding,
  type GselRepoContract,
} from "@/features/personal/gsel-source";
import { IonicFeedbackProvider } from "@/lib/feedback";
import { AppStructForm, type AppStructure } from "@/lib/microform";

const PAIS_SAMPLE: PaisRow[] = [
  {
    PaiCod: asPaiCod(1),
    PaiNom: "Perú",
    PaiEstReg: EST_A,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    PaiCod: asPaiCod(2),
    PaiNom: "Chile",
    PaiEstReg: EST_A,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    PaiCod: asPaiCod(3),
    PaiNom: "Colombia",
    PaiEstReg: EST_I,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    PaiCod: asPaiCod(4),
    PaiNom: "Ecuador",
    PaiEstReg: EST_X,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const formSchema = z.object({
  PerNom: z.string(),
  PerPaiCod: z.number().int().positive(),
});

type HarnessValues = z.infer<typeof formSchema>;
type HarnessField = keyof HarnessValues;

function createFakePaisRepo(): GselRepoContract<PaisRow> {
  return {
    async gsel() {
      return PAIS_SAMPLE.filter((r) => r.PaiEstReg === EST_A).map((r) => ({
        PaiCod: r.PaiCod,
        PaiNom: r.PaiNom,
      }));
    },
    async getByCode(code) {
      return PAIS_SAMPLE.find((r) => r.PaiCod === code) ?? null;
    },
  };
}

async function setIonFieldValue(name: string, value: string) {
  const ionInput = await waitFor(() => {
    const input = document.querySelector(`input[name="${name}"]`);
    const wrapper = input?.closest("ion-input") ?? null;
    if (!wrapper) {
      throw new Error(`Expected ion-input wrapper for ${name}`);
    }
    return wrapper;
  });
  ionInput.dispatchEvent(
    new CustomEvent("ionInput", {
      bubbles: true,
      detail: { value, event: new Event("input") },
    }),
  );
}

function Harness({
  initialPais,
  onSaveSpy,
}: {
  readonly initialPais?: number;
  readonly onSaveSpy: (values: HarnessValues) => void;
}) {
  const binding = createGselBinding({
    table: TABLE_PAIS,
    repo: createFakePaisRepo(),
    codeCol: "PaiCod",
    nomCol: "PaiNom",
    estCol: "PaiEstReg",
  });

  const structure: AppStructure<HarnessField, HarnessValues> = [
    {
      fields: [
        {
          type: "text",
          name: "PerNom",
          label: "Nombre de Personal",
          colspan: 12,
        },
        {
          type: "async_combobox",
          name: "PerPaiCod",
          label: "País",
          placeholder: "Seleccionar país",
          asyncSource: binding.asyncSource,
          resolveLabel: binding.resolveLabel,
          valueType: "number",
          colspan: 12,
        },
      ],
    },
  ];

  const form = useForm<HarnessValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...createFormDefaults(formSchema),
      PerNom: "",
      ...(initialPais !== undefined ? { PerPaiCod: initialPais } : {}),
    },
  });

  return (
    <div>
      <AppStructForm
        form={form}
        schema={formSchema}
        structure={structure}
        onSubmit={onSaveSpy}
        renderSubmit={() => (
          <button type="submit" data-testid="submit-btn">
            Guardar
          </button>
        )}
      />
      <output data-testid="nom-val">
        {String(form.watch("PerNom") ?? "")}
      </output>
      <output data-testid="pai-val">
        {String(form.watch("PerPaiCod") ?? "empty")}
      </output>
      <output data-testid="pai-type">{typeof form.watch("PerPaiCod")}</output>
    </div>
  );
}

describe("AsyncComboboxControl con G-SEL en AppStructForm (Fase 8 unit UI)", () => {
  afterEach(() => {
    cleanup();
  });

  it("prohíbe entrada manual (R6), cancelar preserva campo vacío + PerNom, y seleccionar enlaza número sin guardar", async () => {
    const saveSpy = vi.fn<(values: Record<string, unknown>) => void>();

    render(
      <IonApp>
        <IonicFeedbackProvider>
          <Harness onSaveSpy={saveSpy} />
        </IonicFeedbackProvider>
      </IonApp>,
    );

    // R6: no hay input manual editable para PerPaiCod
    expect(document.querySelector('input[name="PerPaiCod"]')).toBeNull();
    expect(screen.getByTestId("gsel-trigger-PerPaiCod").tagName).toBe(
      "ION-BUTTON",
    );

    await setIonFieldValue("PerNom", "Lucía Ramos");
    await waitFor(() => {
      expect(screen.getByTestId("nom-val").textContent).toBe("Lucía Ramos");
    });

    // Abrir selector, comprobar solo Activos, cancelar -> conserva vacío y PerNom intacto
    fireEvent.click(screen.getByTestId("gsel-trigger-PerPaiCod"));
    expect(await screen.findByTestId("gsel-option-PerPaiCod-2")).toBeTruthy();
    expect(screen.queryByTestId("gsel-option-PerPaiCod-3")).toBeNull();
    expect(screen.queryByTestId("gsel-option-PerPaiCod-4")).toBeNull();

    fireEvent.click(screen.getByTestId("gsel-cancelar-PerPaiCod"));
    await waitFor(() => {
      expect(screen.getByTestId("pai-val").textContent).toBe("empty");
      expect(screen.getByTestId("nom-val").textContent).toBe("Lucía Ramos");
    });
    expect(saveSpy).not.toHaveBeenCalled();

    // Reabrir y seleccionar Chile (#2) -> vincula número 2 sin disparar guardar
    fireEvent.click(screen.getByTestId("gsel-trigger-PerPaiCod"));
    fireEvent.click(await screen.findByTestId("gsel-option-PerPaiCod-2"));

    await waitFor(() => {
      expect(screen.getByTestId("pai-val").textContent).toBe("2");
      expect(screen.getByTestId("pai-type").textContent).toBe("number");
      expect(
        screen.getByTestId("gsel-trigger-PerPaiCod").textContent,
      ).toContain("Chile");
      expect(screen.getByTestId("nom-val").textContent).toBe("Lucía Ramos");
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("muestra etiqueta de FK inactiva en Modificación (R7) y al cancelar mantiene el valor previo", async () => {
    const saveSpy = vi.fn<(values: Record<string, unknown>) => void>();

    render(
      <IonApp>
        <IonicFeedbackProvider>
          <Harness initialPais={3} onSaveSpy={saveSpy} />
        </IonicFeedbackProvider>
      </IonApp>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("gsel-trigger-PerPaiCod").textContent,
      ).toContain("Colombia (Inactivo)");
    });

    fireEvent.click(screen.getByTestId("gsel-trigger-PerPaiCod"));
    expect(await screen.findByTestId("gsel-option-PerPaiCod-1")).toBeTruthy();
    expect(screen.queryByTestId("gsel-option-PerPaiCod-3")).toBeNull();

    fireEvent.click(screen.getByTestId("gsel-cancelar-PerPaiCod"));
    await waitFor(() => {
      expect(screen.getByTestId("pai-val").textContent).toBe("3");
      expect(
        screen.getByTestId("gsel-trigger-PerPaiCod").textContent,
      ).toContain("Colombia (Inactivo)");
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
