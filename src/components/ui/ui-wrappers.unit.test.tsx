import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

describe("UI Ionic/shadcn wrappers", () => {
  it("forwards onClick, aria attributes, data attributes, and asChild slot attributes on Button", () => {
    const onClick = vi.fn();
    render(
      <>
        <Button
          variant="default"
          data-testid="guardar-btn"
          aria-label="Guardar registro"
          onClick={onClick}
        >
          Guardar
        </Button>
        <Button
          asChild
          data-testid="enlace-btn"
          aria-label="Ir a paises"
          disabled
        >
          <a href="#pais">Países</a>
        </Button>
      </>,
    );

    const button = screen.getByTestId("guardar-btn");
    expect(button.getAttribute("aria-label")).toBe("Guardar registro");
    expect(button.getAttribute("data-slot")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    const slotLink = screen.getByTestId("enlace-btn");
    expect(slotLink.getAttribute("data-slot")).toBe("button");
    expect(slotLink.getAttribute("aria-label")).toBe("Ir a paises");
    expect(slotLink.getAttribute("aria-disabled")).toBe("true");
  });

  it("emits synthetic target value on Input ionInput and preserves uncontrolled defaultValue", () => {
    const onChange = vi.fn();
    render(
      <>
        <Input
          name="PerNom"
          value="Inicial"
          readOnly
          aria-label="Nombre"
          aria-invalid={true}
          data-testid="nombre-input"
          onChange={onChange}
        />
        <Input
          name="PerAlias"
          defaultValue="Sin control"
          aria-label="Alias"
          data-testid="alias-input"
        />
      </>,
    );

    const inputEl = screen.getByTestId("nombre-input");
    expect(inputEl.getAttribute("data-slot")).toBe("input");
    expect(inputEl.getAttribute("aria-invalid")).toBe("true");
    expect(inputEl.className).toContain("ion-invalid");

    inputEl.dispatchEvent(
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "Juan Perez", event: new Event("input") },
      }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "PerNom", value: "Juan Perez" },
      currentTarget: { name: "PerNom", value: "Juan Perez" },
    });

    const aliasEl = screen.getByTestId("alias-input");
    expect("value" in aliasEl ? aliasEl.value : undefined).toBe("Sin control");
  });

  it("emits checked boolean on Checkbox ionChange", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        data-testid="estado-check"
        aria-label="Activo"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkboxEl = screen.getByTestId("estado-check");
    expect(checkboxEl.getAttribute("data-slot")).toBe("checkbox");
    expect(checkboxEl.getAttribute("aria-label")).toBe("Activo");

    checkboxEl.dispatchEvent(
      new CustomEvent("ionChange", {
        bubbles: true,
        detail: { checked: true, value: "on" },
      }),
    );

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
