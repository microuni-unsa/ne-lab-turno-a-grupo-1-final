import { IonApp } from "@ionic/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { createFailure, ERROR_CODES } from "@/core";
import {
  type FeedbackAlertSnapshot,
  type FeedbackOverlayAdapter,
  type FeedbackToastSnapshot,
  IonicFeedbackProvider,
  useFeedback,
} from "@/lib/feedback";

function BatchFeedbackConsumer() {
  const feedback = useFeedback();
  return (
    <div>
      <button
        type="button"
        data-testid="trigger-batch"
        onClick={() =>
          feedback.notifyBatchErrors([
            createFailure(ERROR_CODES.REQUIRED, "PerNom"),
            createFailure(ERROR_CODES.FORMAT, "PerDNI"),
            createFailure(ERROR_CODES.REF_STATE, "PerDepCod"),
          ])
        }
      >
        Batch
      </button>
      <button
        type="button"
        data-testid="trigger-pending"
        onClick={() => feedback.alertPending()}
      >
        Pending
      </button>
      <button
        type="button"
        data-testid="trigger-toast"
        onClick={() => feedback.notifySuccess("País guardado")}
      >
        Toast
      </button>
      <button
        type="button"
        data-testid="trigger-network"
        onClick={() => feedback.notifyNetworkError(new Error("ECONNREFUSED"))}
      >
        Network
      </button>
    </div>
  );
}

function ConfirmFeedbackConsumer({
  onResult,
}: {
  readonly onResult: (confirmed: boolean) => void;
}) {
  const feedback = useFeedback();
  const [status, setStatus] = React.useState("idle");

  const ask = async () => {
    const confirmed = await feedback.confirmAction({
      title: "Eliminar país",
      message: "¿Confirma eliminar?",
      destructive: true,
    });
    onResult(confirmed);
    setStatus(confirmed ? "accepted" : "cancelled");
  };

  return (
    <div>
      <button
        type="button"
        data-testid="ask-confirm"
        onClick={() => {
          void ask();
        }}
      >
        Confirmar
      </button>
      <button
        type="button"
        data-testid="interrupt-confirm"
        onClick={() => feedback.alertPending()}
      >
        Interrumpir
      </button>
      <span data-testid="confirm-status">{status}</span>
    </div>
  );
}

describe("IonicFeedbackProvider integration", () => {
  it("reports batch E-* failures per R22 and exposes header/message on IonAlert", () => {
    const alerts: FeedbackAlertSnapshot[] = [];
    const toasts: FeedbackToastSnapshot[] = [];

    const adapter: FeedbackOverlayAdapter = {
      presentAlert(snapshot) {
        alerts.push(snapshot);
      },
      presentToast(snapshot) {
        toasts.push(snapshot);
      },
    };

    render(
      <IonApp>
        <IonicFeedbackProvider adapter={adapter}>
          <BatchFeedbackConsumer />
        </IonicFeedbackProvider>
      </IonApp>,
    );

    fireEvent.click(screen.getByTestId("trigger-batch"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain("[E-REQUIRED]");
    expect(alerts[0].message).toContain("[E-FORMAT]");
    expect(alerts[0].message).toContain("[E-REF-STATE]");

    const ionAlert = document.querySelector('[data-testid="feedback-alert"]');
    expect(ionAlert).not.toBeNull();
    if (ionAlert) {
      expect(Reflect.get(ionAlert, "isOpen")).toBe(true);
      expect(String(Reflect.get(ionAlert, "message"))).toContain(
        "[E-REF-STATE]",
      );
    }

    fireEvent.click(screen.getByTestId("trigger-pending"));
    expect(alerts).toHaveLength(2);
    expect(alerts[1].subHeader).toContain("[E-PENDING]");

    fireEvent.click(screen.getByTestId("trigger-network"));
    expect(alerts).toHaveLength(3);
    expect(alerts[2].subHeader).toContain("[E-NETWORK]");
    expect(alerts[2].message).toContain("ECONNREFUSED");

    fireEvent.click(screen.getByTestId("trigger-toast"));
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("País guardado");
    expect(toasts[0].color).toBe("success");
  });

  it("resolves confirmAction true/false depending on controlled alert button resolution", async () => {
    const pendingResolvers: Array<(confirmed: boolean) => void> = [];
    const onResult = vi.fn();

    const adapter: FeedbackOverlayAdapter = {
      presentAlert(_snapshot, resolve) {
        pendingResolvers.push(resolve);
      },
    };

    render(
      <IonApp>
        <IonicFeedbackProvider adapter={adapter}>
          <ConfirmFeedbackConsumer onResult={onResult} />
        </IonicFeedbackProvider>
      </IonApp>,
    );

    fireEvent.click(screen.getByTestId("ask-confirm"));
    expect(pendingResolvers).toHaveLength(1);
    pendingResolvers[0](false);

    await waitFor(() => {
      expect(onResult).toHaveBeenLastCalledWith(false);
      expect(screen.getByTestId("confirm-status").textContent).toBe(
        "cancelled",
      );
    });

    fireEvent.click(screen.getByTestId("ask-confirm"));
    expect(pendingResolvers).toHaveLength(2);
    pendingResolvers[1](true);

    await waitFor(() => {
      expect(onResult).toHaveBeenLastCalledWith(true);
      expect(screen.getByTestId("confirm-status").textContent).toBe("accepted");
    });

    fireEvent.click(screen.getByTestId("ask-confirm"));
    expect(pendingResolvers).toHaveLength(3);
    fireEvent.click(screen.getByTestId("interrupt-confirm"));

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(3);
      expect(onResult).toHaveBeenLastCalledWith(false);
      expect(screen.getByTestId("confirm-status").textContent).toBe(
        "cancelled",
      );
    });
  });
});
