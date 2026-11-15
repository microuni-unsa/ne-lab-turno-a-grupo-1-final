import { IonApp } from "@ionic/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function readIsOpenProp(el: Element): unknown {
  return Reflect.get(el, "isOpen");
}

function SelectHarness({
  onValueChange,
}: {
  readonly onValueChange: (next: string) => void;
}) {
  const [value, setValue] = React.useState("");
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
    >
      <SelectTrigger aria-label="Cargo" data-testid="cargo-trigger">
        <SelectValue placeholder="Seleccione cargo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">Analista de Sistemas</SelectItem>
        <SelectItem value="2">Programador</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("UI overlays (Drawer, Dialog, AlertDialog, Select)", () => {
  it("opens Select, emits onValueChange on option click, and updates SelectValue", () => {
    const onValueChange = vi.fn();
    render(
      <IonApp>
        <SelectHarness onValueChange={onValueChange} />
      </IonApp>,
    );
    const trigger = screen.getByTestId("cargo-trigger");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("Seleccione cargo");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const modal = document.querySelector('[data-slot="select-content"]');
    expect(modal).not.toBeNull();
    if (modal) {
      expect(readIsOpenProp(modal)).toBe(true);
    }

    const selectItems = document.querySelectorAll('[data-slot="select-item"]');
    expect(selectItems).toHaveLength(2);
    const secondOption = selectItems[1];
    if (!secondOption) {
      throw new Error("Expected second select item");
    }
    fireEvent.click(secondOption);

    expect(onValueChange).toHaveBeenCalledWith("2");
    expect(trigger.textContent).toContain("Programador");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("controls Drawer open and close state through triggers and IonModal dismiss", () => {
    const onOpenChange = vi.fn();
    render(
      <IonApp>
        <Drawer onOpenChange={onOpenChange}>
          <DrawerTrigger data-testid="drawer-open">Abrir</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filtros</DrawerTitle>
              <DrawerDescription>Panel deslizable</DrawerDescription>
            </DrawerHeader>
            <DrawerClose data-testid="drawer-close">Cerrar</DrawerClose>
          </DrawerContent>
        </Drawer>
      </IonApp>,
    );

    const modal = document.querySelector('[data-slot="drawer"]');
    expect(modal).not.toBeNull();
    if (!modal) {
      throw new Error("Expected drawer modal");
    }

    fireEvent.click(screen.getByTestId("drawer-open"));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(readIsOpenProp(modal)).toBe(true);

    act(() => {
      modal.dispatchEvent(new CustomEvent("ionMount", { bubbles: true }));
      modal.dispatchEvent(new CustomEvent("willPresent", { bubbles: true }));
    });
    expect(screen.getByText("Filtros")).toBeDefined();

    fireEvent.click(screen.getByTestId("drawer-close"));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("opens Dialog and handles dismiss cleanly", () => {
    const onOpenChange = vi.fn();
    render(
      <IonApp>
        <Dialog onOpenChange={onOpenChange}>
          <DialogTrigger data-testid="dialog-open">Detalle</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resumen</DialogTitle>
              <DialogDescription>Información del registro</DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton={true} />
          </DialogContent>
        </Dialog>
      </IonApp>,
    );

    const modal = document.querySelector('[data-slot="dialog"]');
    if (!modal) {
      throw new Error("Expected dialog modal");
    }

    fireEvent.click(screen.getByTestId("dialog-open"));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    act(() => {
      modal.dispatchEvent(new CustomEvent("ionMount", { bubbles: true }));
      modal.dispatchEvent(new CustomEvent("willPresent", { bubbles: true }));
    });
    expect(screen.getByText("Resumen")).toBeDefined();

    act(() => {
      modal.dispatchEvent(new CustomEvent("didDismiss", { bubbles: true }));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps backdropDismiss disabled on AlertDialog and invokes action/cancel", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <IonApp>
        <AlertDialog onOpenChange={onOpenChange}>
          <AlertDialogTrigger data-testid="alert-open">
            Eliminar
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar</AlertDialogTitle>
              <AlertDialogDescription>Acción terminal</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="alert-cancel">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                data-testid="alert-confirm"
                onClick={onConfirm}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </IonApp>,
    );

    const modal = document.querySelector('[data-slot="alert-dialog"]');
    if (!modal) {
      throw new Error("Expected alert-dialog modal");
    }
    expect(Reflect.get(modal, "backdropDismiss")).toBe(false);

    fireEvent.click(screen.getByTestId("alert-open"));
    act(() => {
      modal.dispatchEvent(new CustomEvent("ionMount", { bubbles: true }));
      modal.dispatchEvent(new CustomEvent("willPresent", { bubbles: true }));
    });

    fireEvent.click(screen.getByTestId("alert-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
