/**
 * Maestro de Personal — Supabase Client Singleton
 *
 * SPEC §1, §14. Supabase-hosted Postgres.
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
 * Fails fast with explicit Error if variables are missing; never defaults URLs or keys.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readRequiredEnv(
  name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY",
): string {
  let val: string | undefined;

  // Browser / Vite environment
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env[name] === "string"
  ) {
    val = import.meta.env[name];
  } else {
    // Node / Bun script or test environment via globalThis.process without unsafe casts
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
        if (typeof raw === "string") {
          val = raw;
        }
      }
    }
  }

  if (val === undefined || val === null || val.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return val.trim();
}

let clientInstance: SupabaseClient | null = null;

/**
 * Returns the initialized SupabaseClient singleton instance.
 * Fails fast with an explicit Error if required environment variables are absent.
 */
export function getSupabaseClient(): SupabaseClient {
  if (clientInstance === null) {
    const supabaseUrl = readRequiredEnv("VITE_SUPABASE_URL");
    const supabaseKey = readRequiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
    // Disable postgrest-js hidden multi-attempt backoff so TanStack Query owns single retry timing on mobile
    clientInstance = createClient(supabaseUrl, supabaseKey, {
      db: { retry: false },
    });
  }
  return clientInstance;
}
