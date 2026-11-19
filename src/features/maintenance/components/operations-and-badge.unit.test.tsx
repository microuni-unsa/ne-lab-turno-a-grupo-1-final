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
  { id: "salir", label: "Salir", handlerKey: "onSalir" },
] as const;

function isButtonDisabled(el: HTMLElement): boolean {
  return Boolean(Reflect.get(el, "disabled")) || el.hasAttribute("disabled");
}

describe("EstadoBadge", () => {
  it("muestra texto plano normativo para EstReg 1 (Activo), 2 (Inactivo) y 3 (Eliminado)", () => {
    render(
      <div>
        <EstadoBadge state={EST_A} />
        <EstadoBadge state={EST_I} />
        <EstadoBadge state={EST_X} />
      </div>,
    );

    expect(screen.getByText("Activo")).toBeTruthy();
    expect(screen.getByText("Inactivo")).toBeTruthy();
    expect(screen.getByText("Eliminado")).toBeTruthy();
  });
});

describe("OperationsBar", () => {
  it("expone las 8 etiquetas de operación en español y habilita/deshabilita botones según contexto", () => {
    const handlers = {
      onAdicionar: vi.fn(),
      onModificar: vi.fn(),
      onEliminar: vi.fn(),
      onInactivar: vi.fn(),
      onReactivar: vi.fn(),
      onGuardar: vi.fn(),
      onCancelar: vi.fn(),
      onSalir: vi.fn(),
    };

    const { container, rerender } = render(
      <OperationsBar hasPending={false} selectedState={null} {...handlers} />,
    );

    for (const op of EXPECTED_OPERATIONS) {
      const btn = screen.getByTestId(`op-${op.id}`);
      expect(btn.textContent?.trim()).toBe(op.label);
    }

    // Idle sin selección: solo Adicionar y Salir habilitados
    expect(isButtonDisabled(screen.getByTestId("op-adicionar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-salir"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-modificar"))).toBe(true);
    expect(isButtonDisabled(screen.getByTestId("op-guardar"))).toBe(true);
    expect(isButtonDisabled(screen.getByTestId("op-cancelar"))).toBe(true);

    // Idle con Activo (A): Modificar/Inactivar/Eliminar habilitados, Reactivar/Guardar deshabilitados
    rerender(
      <OperationsBar hasPending={false} selectedState={EST_A} {...handlers} />,
    );
    expect(isButtonDisabled(screen.getByTestId("op-modificar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-inactivar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-eliminar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-reactivar"))).toBe(true);
    expect(isButtonDisabled(screen.getByTestId("op-guardar"))).toBe(true);

    // Idle con Inactivo (I): Reactivar/Eliminar habilitados, Modificar/Inactivar deshabilitados
    rerender(
      <OperationsBar hasPending={false} selectedState={EST_I} {...handlers} />,
    );
    expect(isButtonDisabled(screen.getByTestId("op-reactivar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-eliminar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-modificar"))).toBe(true);
    expect(isButtonDisabled(screen.getByTestId("op-inactivar"))).toBe(true);

    // Idle con Eliminado (*): solo Reactivar (autorización supervisor) entre las ops de fila
    rerender(
      <OperationsBar hasPending={false} selectedState={EST_X} {...handlers} />,
    );
    expect(isButtonDisabled(screen.getByTestId("op-reactivar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-modificar"))).toBe(true);
    expect(isButtonDisabled(screen.getByTestId("op-eliminar"))).toBe(true);

    // Operación pendiente: Guardar, Cancelar y Salir habilitados; mutaciones deshabilitados
    rerender(
      <OperationsBar hasPending={true} selectedState={EST_A} {...handlers} />,
    );
    expect(isButtonDisabled(screen.getByTestId("op-guardar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-cancelar"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-salir"))).toBe(false);
    expect(isButtonDisabled(screen.getByTestId("op-adicionar"))).toBe(true);

    fireEvent.click(screen.getByTestId("op-guardar"));
    expect(handlers.onGuardar).toHaveBeenCalledTimes(1);

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
