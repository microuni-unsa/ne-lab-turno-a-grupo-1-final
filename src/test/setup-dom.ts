import {
  defineCustomElement as defineIonAlert,
  IonAlert,
} from "@ionic/core/components/ion-alert.js";
import {
  defineCustomElement as defineIonModal,
  IonModal,
} from "@ionic/core/components/ion-modal.js";
import {
  defineCustomElement as defineIonToast,
  IonToast,
} from "@ionic/core/components/ion-toast.js";
import { setupIonicReact } from "@ionic/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

setupIonicReact();
defineIonAlert();
defineIonModal();
defineIonToast();

function installJsdomOverlayStub(proto: {
  present?: () => Promise<void>;
  dismiss?: (data?: unknown, role?: string) => Promise<boolean>;
}) {
  proto.present = async function presentInJsdom(
    this: EventTarget,
  ): Promise<void> {
    this.dispatchEvent(new CustomEvent("ionMount", { bubbles: true }));
    this.dispatchEvent(new CustomEvent("willPresent", { bubbles: true }));
    this.dispatchEvent(new CustomEvent("didPresent", { bubbles: true }));
  };

  proto.dismiss = async function dismissInJsdom(
    this: EventTarget,
    data?: unknown,
    role?: string,
  ): Promise<boolean> {
    this.dispatchEvent(
      new CustomEvent("willDismiss", {
        bubbles: true,
        detail: { data, role },
      }),
    );
    this.dispatchEvent(
      new CustomEvent("didDismiss", {
        bubbles: true,
        detail: { data, role },
      }),
    );
    return true;
  };
}

if (typeof window !== "undefined") {
  // Stencil overlays require a layout engine and framework delegate to attach/animate views;
  // in jsdom we emit their lifecycle events synchronously so @ionic/react mounts/dismisses cleanly
  // without leaving dangling animation focus callbacks after unmount.
  installJsdomOverlayStub(IonAlert.prototype);
  installJsdomOverlayStub(IonModal.prototype);
  installJsdomOverlayStub(IonToast.prototype);
}

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  Object.defineProperty(window, "scrollTo", {
    writable: true,
    configurable: true,
    value: () => {},
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = MockResizeObserver;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly scrollMargin = "";
    readonly thresholds: readonly number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver;
}

if (typeof Element !== "undefined") {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

if (typeof HTMLElement !== "undefined") {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
}

afterEach(() => {
  cleanup();
});
