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
    import.meta.env[name]
  ) {
    val = import.meta.env[name];
  } else {
    // Node / Bun script or test environment via globalThis.process
    const proc = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process;
    if (proc && proc.env && proc.env[name]) {
      val = proc.env[name];
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
    clientInstance = createClient(supabaseUrl, supabaseKey);
  }
  return clientInstance;
}

/**
 * Lazy SupabaseClient proxy singleton.
 * Defers client creation until first property access.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
