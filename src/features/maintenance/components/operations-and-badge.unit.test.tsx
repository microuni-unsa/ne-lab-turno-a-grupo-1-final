import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EST_A, EST_I, EST_X } from "@/core";
import { EstadoBadge } from "@/features/maintenance/components/EstadoBadge";
import { MaintenanceLayout } from "@/features/maintenance/components/MaintenanceLayout";
import { OperationsBar } from "@/features/maintenance/components/OperationsBar";

const EXPECTED_OPERATIONS = [
  { id: "adicionar", label: "Adicionar", handlerKey: "onAdicionar" },
  { id: "modificar", label: "Modificar", handlerKey: "onModificar" },
  { id: "eliminar", label: "Eliminar", handlerKey: "onEliminar" },
  { id: "inactivar", label: "Inactivar", handlerKey: "onInactivar" },
  { id: "reactivar", label: "Reactivar", handlerKey: "onReactivar" },
  { id: "guardar", label: "Guardar", handlerKey: "onGuardar" },
  { id: "cancelar", label: "Cancelar", handlerKey: "onCancelar" },
  { id: "buscar", label: "Buscar", handlerKey: "onBuscar" },
  { id: "salir", label: "Salir", handlerKey: "onSalir" },
] as const;

function isButtonDisabled(el: HTMLElement): boolean {
  return Boolean(Reflect.get(el, "disabled")) || el.hasAttribute("disabled");
}

describe("EstadoBadge", () => {
  it("muestra símbolo y etiqueta normativos para EstReg 1 (A), 2 (I) y 3 (*)", () => {
    render(
      <div>
        <EstadoBadge state={EST_A} />
        <EstadoBadge state={EST_I} />
        <EstadoBadge state={EST_X} />
        <EstadoBadge state={EST_A} compact />
        <EstadoBadge state={EST_I} compact />
        <EstadoBadge state={EST_X} compact />
      </div>,
    );

    expect(screen.getByText("A · Activo")).toBeTruthy();
    expect(screen.getByText("I · Inactivo")).toBeTruthy();
    expect(screen.getByText("* · Eliminado")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("I")).toBeTruthy();
    expect(screen.getByText("*")).toBeTruthy();
  });
});

describe("OperationsBar", () => {
  it("expone las 9 etiquetas normativas en español y dispara los handlers sin bloquear botones de segunda operación", () => {
    const handlers = {
      onAdicionar: vi.fn(),
      onModificar: vi.fn(),
      onEliminar: vi.fn(),
      onInactivar: vi.fn(),
      onReactivar: vi.fn(),
      onGuardar: vi.fn(),
      onCancelar: vi.fn(),
      onBuscar: vi.fn(),
      onSalir: vi.fn(),
    };

    const { container } = render(
      <OperationsBar hasPending={true} {...handlers} />,
    );

    for (const op of EXPECTED_OPERATIONS) {
      const btn = screen.getByTestId(`op-${op.id}`);
      expect(btn.textContent?.trim()).toBe(op.label);
      expect(isButtonDisabled(btn)).toBe(false);
      fireEvent.click(btn);
      expect(handlers[op.handlerKey]).toHaveBeenCalledTimes(1);
    }

    const allText = container.textContent ?? "";
    expect(allText).not.toMatch(/Actualizar/i);
    expect(allText).not.toMatch(/Submit/i);
  });

  it("deshabilita Guardar únicamente mientras isSaving=true", () => {
    const noop = () => {};
    render(
      <OperationsBar
        hasPending={true}
        isSaving={true}
        onAdicionar={noop}
        onModificar={noop}
        onEliminar={noop}
        onInactivar={noop}
        onReactivar={noop}
        onGuardar={noop}
        onCancelar={noop}
        onBuscar={noop}
        onSalir={noop}
      />,
    );

    const saveBtn = screen.getByTestId("op-guardar");
    expect(saveBtn.textContent?.trim()).toBe("Guardar");
    expect(isButtonDisabled(saveBtn)).toBe(true);
  });
});

describe("MaintenanceLayout guard Salir", () => {
  it("invoca onSalir al pulsar Salir y bloquea navegación cuando hasPending impide salir", () => {
    const onExitAllowed = vi.fn();
    let hasPending = true;
    const onSalir = vi.fn(() => !hasPending);

    render(
      <MaintenanceLayout
        id="test-layout"
        title="Países"
        onSalir={onSalir}
        onExitAllowed={onExitAllowed}
      >
        <div>Contenido</div>
      </MaintenanceLayout>,
    );

    const salirBtn = screen.getByTestId("toolbar-salir");
    fireEvent.click(salirBtn);

    expect(onSalir).toHaveBeenCalledTimes(1);
    expect(onExitAllowed).not.toHaveBeenCalled();

    hasPending = false;
    fireEvent.click(salirBtn);

    expect(onSalir).toHaveBeenCalledTimes(2);
    expect(onExitAllowed).toHaveBeenCalledTimes(1);
  });
});
