import type { AlertButton, OverlayEventDetail, ToastButton } from "@ionic/core";
import { IonAlert, IonToast } from "@ionic/react";
import * as React from "react";
import { createFailure, ERROR_CODES, type FieldFailure } from "@/core";
import {
  formatBatchFailures,
  formatFieldFailure,
  formatNetworkError,
} from "@/lib/error-catalog";

export interface ConfirmActionOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
}

export interface FeedbackPort {
  notifySuccess(message: string): void;
  notifyWarning(message: string): void;
  notifyBatchErrors(failures: readonly FieldFailure[]): void;
  notifyNetworkError(error: unknown): void;
  confirmAction(options: ConfirmActionOptions): Promise<boolean>;
  alertPending(): void;
}

export interface FeedbackAlertSnapshot {
  readonly id: number;
  readonly kind: "alert" | "confirm";
  readonly header: string;
  readonly subHeader?: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly destructive: boolean;
}

export interface FeedbackToastSnapshot {
  readonly id: number;
  readonly message: string;
  readonly color: "success" | "warning";
}

export interface FeedbackOverlayAdapter {
  presentAlert?: (
    snapshot: FeedbackAlertSnapshot,
    resolve: (confirmed: boolean) => void,
  ) => void;
  presentToast?: (snapshot: FeedbackToastSnapshot) => void;
}

const FeedbackContext = React.createContext<FeedbackPort | null>(null);

export function useFeedback(): FeedbackPort {
  const ctx = React.useContext(FeedbackContext);
  if (!ctx) {
    throw new Error(
      "useFeedback debe utilizarse dentro de <IonicFeedbackProvider>",
    );
  }
  return ctx;
}

interface ActiveAlertState extends FeedbackAlertSnapshot {
  readonly resolveAndClear: (confirmed: boolean) => void;
}

const TOAST_DISMISS_BUTTONS: ToastButton[] = [
  { text: "Cerrar", role: "cancel" },
];

export interface IonicFeedbackProviderProps {
  readonly children: React.ReactNode;
  readonly adapter?: FeedbackOverlayAdapter;
}

export function IonicFeedbackProvider({
  children,
  adapter,
}: IonicFeedbackProviderProps) {
  const nextIdRef = React.useRef(1);
  const [toast, setToast] = React.useState<FeedbackToastSnapshot | null>(null);
  const [alertState, setAlertState] = React.useState<ActiveAlertState | null>(
    null,
  );
  const alertStateRef = React.useRef<ActiveAlertState | null>(null);
  alertStateRef.current = alertState;

  const adapterRef = React.useRef(adapter);
  adapterRef.current = adapter;

  const isAlertDismissingRef = React.useRef(false);
  const presentedAlertIdRef = React.useRef<number | null>(null);
  const queuedAlertRef = React.useRef<ActiveAlertState | null>(null);

  React.useEffect(() => {
    if (alertState) {
      presentedAlertIdRef.current = alertState.id;
    }
  }, [alertState]);

  React.useEffect(() => {
    return () => {
      alertStateRef.current?.resolveAndClear(false);
      queuedAlertRef.current?.resolveAndClear(false);
    };
  }, []);

  const openAlert = React.useCallback(
    (snapshot: Omit<FeedbackAlertSnapshot, "id">): Promise<boolean> => {
      const previous = alertStateRef.current;
      if (previous) {
        previous.resolveAndClear(false);
      }
      const previousQueued = queuedAlertRef.current;
      if (previousQueued) {
        queuedAlertRef.current = null;
        previousQueued.resolveAndClear(false);
      }

      const id = nextIdRef.current++;
      const fullSnapshot: FeedbackAlertSnapshot = { ...snapshot, id };

      return new Promise<boolean>((resolve) => {
        let settled = false;
        const resolveAndClear = (confirmed: boolean) => {
          if (!settled) {
            settled = true;
            resolve(confirmed);
          }
          setAlertState((current) =>
            current && current.id === id ? null : current,
          );
          if (queuedAlertRef.current?.id === id) {
            queuedAlertRef.current = null;
          }
        };

        const nextAlert: ActiveAlertState = {
          ...fullSnapshot,
          resolveAndClear,
        };

        if (isAlertDismissingRef.current) {
          queuedAlertRef.current = nextAlert;
        } else {
          alertStateRef.current = nextAlert;
          setAlertState(nextAlert);
        }

        adapterRef.current?.presentAlert?.(fullSnapshot, resolveAndClear);
      });
    },
    [],
  );

  const showToast = React.useCallback(
    (message: string, color: "success" | "warning") => {
      const id = nextIdRef.current++;
      const snapshot: FeedbackToastSnapshot = { id, message, color };
      setToast(snapshot);
      adapterRef.current?.presentToast?.(snapshot);
    },
    [],
  );

  const port = React.useMemo<FeedbackPort>(
    () => ({
      notifySuccess(message: string) {
        showToast(message, "success");
      },
      notifyWarning(message: string) {
        showToast(message, "warning");
      },
      notifyBatchErrors(failures: readonly FieldFailure[]) {
        if (failures.length === 0) {
          return;
        }
        const report = formatBatchFailures(failures);
        void openAlert({
          kind: "alert",
          header: report.title,
          subHeader: report.headline,
          message: report.text,
          confirmLabel: "Entendido",
          destructive: false,
        });
      },
      notifyNetworkError(error: unknown) {
        const notice = formatNetworkError(error);
        void openAlert({
          kind: "alert",
          header: notice.title,
          subHeader: `[${notice.code}] Conexión obligatoria`,
          message: notice.message,
          confirmLabel: "Entendido",
          destructive: true,
        });
      },
      confirmAction(options: ConfirmActionOptions): Promise<boolean> {
        return openAlert({
          kind: "confirm",
          header: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? "Confirmar",
          cancelLabel: options.cancelLabel ?? "Cancelar",
          destructive: options.destructive ?? false,
        });
      },
      alertPending() {
        const pendingFailure = formatFieldFailure(
          createFailure(ERROR_CODES.PENDING, "session"),
        );
        void openAlert({
          kind: "alert",
          header: pendingFailure.title,
          subHeader: `[${pendingFailure.code}] ${pendingFailure.fieldLabel}`,
          message: pendingFailure.message,
          confirmLabel: "Entendido",
          destructive: false,
        });
      },
    }),
    [openAlert, showToast],
  );

  const alertButtons = React.useMemo<AlertButton[]>(() => {
    if (!alertState) {
      return [];
    }
    if (alertState.kind === "alert") {
      return [
        {
          text: alertState.confirmLabel,
          role: "confirm",
          handler: () => {
            alertState.resolveAndClear(true);
          },
        },
      ];
    }
    return [
      {
        text: alertState.cancelLabel ?? "Cancelar",
        role: "cancel",
        handler: () => {
          alertState.resolveAndClear(false);
        },
      },
      {
        text: alertState.confirmLabel,
        role: alertState.destructive ? "destructive" : "confirm",
        handler: () => {
          alertState.resolveAndClear(true);
        },
      },
    ];
  }, [alertState]);

  const handleAlertWillPresent = React.useCallback(() => {
    isAlertDismissingRef.current = false;
    presentedAlertIdRef.current = alertStateRef.current?.id ?? null;
  }, []);

  const handleAlertWillDismiss = React.useCallback(() => {
    isAlertDismissingRef.current = true;
  }, []);

  const handleAlertDismiss = React.useCallback(
    (event: CustomEvent<OverlayEventDetail>) => {
      isAlertDismissingRef.current = false;
      const dismissedId = presentedAlertIdRef.current;
      presentedAlertIdRef.current = null;

      const current = alertStateRef.current;
      if (current && (dismissedId === null || current.id === dismissedId)) {
        const confirmed =
          current.kind === "confirm"
            ? event.detail.role === "confirm" ||
              event.detail.role === "destructive"
            : true;
        current.resolveAndClear(confirmed);
      }

      const queued = queuedAlertRef.current;
      if (queued) {
        queuedAlertRef.current = null;
        alertStateRef.current = queued;
        setAlertState(queued);
      }
    },
    [],
  );

  const handleToastDismiss = React.useCallback((expectedId: number | null) => {
    if (expectedId === null) {
      return;
    }
    setToast((current) =>
      current && current.id === expectedId ? null : current,
    );
  }, []);

  const currentToastId = toast?.id ?? null;

  return (
    <FeedbackContext.Provider value={port}>
      {children}
      <IonToast
        data-testid="feedback-toast"
        isOpen={toast !== null}
        message={toast?.message ?? ""}
        color={toast?.color}
        duration={2800}
        position="bottom"
        swipeGesture="vertical"
        buttons={TOAST_DISMISS_BUTTONS}
        onDidDismiss={() => handleToastDismiss(currentToastId)}
      />
      <IonAlert
        data-testid="feedback-alert"
        isOpen={alertState !== null}
        header={alertState?.header}
        subHeader={alertState?.subHeader}
        message={alertState?.message}
        cssClass="maestro-feedback-alert"
        backdropDismiss={alertState?.kind !== "confirm"}
        buttons={alertButtons}
        onWillPresent={handleAlertWillPresent}
        onWillDismiss={handleAlertWillDismiss}
        onDidDismiss={handleAlertDismiss}
      />
    </FeedbackContext.Provider>
  );
}
