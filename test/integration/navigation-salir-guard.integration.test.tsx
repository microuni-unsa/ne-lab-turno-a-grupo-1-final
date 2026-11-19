import { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("Navigation shell & Salir guard integration (SPEC §8.7)", () => {
  it("bloquea Salir con E-PENDING mientras hay operación armada y vuelve a / cuando la sesión está limpia", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(<App initialEntries={["/", "/pais"]} client={queryClient} />);

    expect(await screen.findByText("Países")).toBeTruthy();
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO CONSULTA",
    );

    // 1. Armar operación Adición -> bloquea Salir desde toolbar con [E-PENDING]
    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );

    fireEvent.click(screen.getByTestId("toolbar-salir"));

    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      expect(Reflect.get(alert ?? {}, "isOpen")).toBe(true);
      expect(String(Reflect.get(alert ?? {}, "subHeader"))).toContain(
        "[E-PENDING]",
      );
    });

    // El borrador sigue vivo y no navegó fuera de /pais
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );

    // 2. Cancelar limpia el pendiente y luego Salir vuelve al hub /
    fireEvent.click(screen.getByTestId("op-cancelar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO CONSULTA",
    );

    fireEvent.click(screen.getByTestId("toolbar-salir"));

    await waitFor(() => {
      expect(screen.getByTestId("nav-pais")).toBeTruthy();
      expect(screen.getByTestId("nav-dependencia")).toBeTruthy();
      expect(screen.getByTestId("nav-cargo")).toBeTruthy();
      expect(screen.getByTestId("nav-personal")).toBeTruthy();
    });
  });

  it("permite Salir directo en sesión limpia desde ruta protegida", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(<App initialEntries={["/dependencia"]} client={queryClient} />);

    expect(await screen.findByText("Dependencias")).toBeTruthy();
    fireEvent.click(screen.getByTestId("op-salir"));

    await waitFor(() => {
      expect(screen.getByText("Soluciones Móviles S.A.C.")).toBeTruthy();
      expect(screen.getByTestId("home-connectivity-status")).toBeTruthy();
    });
  });
});
