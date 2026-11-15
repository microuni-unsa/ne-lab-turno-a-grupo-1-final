import { useIonRouter } from "@ionic/react";
import * as React from "react";

/**
 * Shared guard hook for Salir (SPEC §8.7): checks controller before navigating home.
 */
export function useGuardedExit(
  onSalir: () => boolean,
  onExitAllowed?: () => void,
): () => boolean {
  const ionRouter = useIonRouter();
  const onSalirRef = React.useRef(onSalir);
  onSalirRef.current = onSalir;

  const onExitAllowedRef = React.useRef(onExitAllowed);
  onExitAllowedRef.current = onExitAllowed;

  return React.useCallback(() => {
    const allowed = onSalirRef.current();
    if (!allowed) {
      return false;
    }

    if (onExitAllowedRef.current) {
      onExitAllowedRef.current();
      return true;
    }

    if (ionRouter.routeInfo !== undefined) {
      if (ionRouter.canGoBack()) {
        ionRouter.goBack();
      } else {
        ionRouter.navigateRoot("/");
      }
    }

    return true;
  }, [ionRouter]);
}
