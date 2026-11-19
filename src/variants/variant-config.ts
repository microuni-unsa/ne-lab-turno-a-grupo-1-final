export type AppVariant = "original" | "A" | "B" | "C";

/**
 * Resolves the active UI variant from `VITE_APP_VARIANT`.
 * When unset or empty, preserves the original application UI (`"original"`).
 * Throws explicitly on unknown values.
 */
export function resolveAppVariant(raw: string | undefined): AppVariant {
  if (raw === undefined) {
    return "original";
  }
  const normalized = raw.trim().toUpperCase();
  if (normalized === "" || normalized === "ORIGINAL") {
    return "original";
  }
  switch (normalized) {
    case "A":
      return "A";
    case "B":
      return "B";
    case "C":
      return "C";
    default:
      throw new Error(
        `Unknown VITE_APP_VARIANT "${raw}". Expected A, B, C, or original.`,
      );
  }
}
