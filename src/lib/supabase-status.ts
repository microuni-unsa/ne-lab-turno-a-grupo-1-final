import * as React from "react";

export interface SupabaseEnvStatus {
  readonly configured: boolean;
  readonly missingVars: readonly string[];
}

const REQUIRED_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

function readEnvValue(
  name: (typeof REQUIRED_ENV_KEYS)[number],
): string | undefined {
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env[name] === "string"
  ) {
    return import.meta.env[name];
  }

  const maybeProcess: unknown = Object.getOwnPropertyDescriptor(
    globalThis,
    "process",
  )?.value;
  if (
    typeof maybeProcess === "object" &&
    maybeProcess !== null &&
    "env" in maybeProcess
  ) {
    const maybeEnv: unknown = maybeProcess.env;
    if (typeof maybeEnv === "object" && maybeEnv !== null) {
      const raw: unknown = Object.getOwnPropertyDescriptor(
        maybeEnv,
        name,
      )?.value;
      return typeof raw === "string" ? raw : undefined;
    }
  }

  return undefined;
}

/**
 * Checks whether required Supabase public credentials are configured
 * without triggering singleton client construction errors.
 */
export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const missingVars: string[] = [];

  for (const key of REQUIRED_ENV_KEYS) {
    const raw = readEnvValue(key);
    if (typeof raw !== "string" || raw.trim().length === 0) {
      missingVars.push(key);
    }
  }

  return {
    configured: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Tracks browser online/offline connectivity honestly per SPEC §14 (no offline mode).
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = React.useState<boolean>(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
