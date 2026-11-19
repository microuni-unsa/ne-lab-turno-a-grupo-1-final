import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import { EST_A, EST_I, EST_X, type EstReg, type PaisRow } from "@/core";
import { useMaintenanceScreen } from "@/features/maintenance/use-maintenance-screen";
import {
  paisConfig,
  type ReferenceRepoContract,
} from "@/features/reference/reference-config";

export interface UsePaisVariantScreenOptions {
  readonly client?: SupabaseClient;
  readonly repo?: ReferenceRepoContract<PaisRow>;
}

export interface PaisStateCounts {
  readonly active: number;
  readonly inactive: number;
  readonly deleted: number;
}

export function formatPaisCode(code: string): string {
  return code;
}

export function getStateMeta(estReg: EstReg): {
  readonly code: "A" | "I" | "*";
  readonly label: string;
} {
  switch (estReg) {
    case EST_A:
      return { code: "A", label: "Activo" };
    case EST_I:
      return { code: "I", label: "Inactivo" };
    case EST_X:
      return { code: "*", label: "Eliminado" };
  }
}

/**
 * Shared PAIS-only screen controller for variants A, B, and C.
 * Reuses `paisConfig` and `useMaintenanceScreen` with zero duplicated business logic.
 */
export function usePaisVariantScreen({
  client,
  repo: repoOverride,
}: UsePaisVariantScreenOptions = {}) {
  const repo = React.useMemo(
    () => repoOverride ?? paisConfig.createRepo(client),
    [client, repoOverride],
  );

  const screen = useMaintenanceScreen({
    table: paisConfig.table,
    repo,
    defaultOrdering: paisConfig.defaultOrdering ?? "default",
    getRowCode: paisConfig.getRowCode,
    getRowState: paisConfig.getRowState,
    rowToPayload: paisConfig.rowToPayload,
    validatePayload: (payload, isUpdate) =>
      paisConfig.validatePayload(payload, isUpdate),
  });

  const stateCounts = React.useMemo<PaisStateCounts>(() => {
    let active = 0;
    let inactive = 0;
    let deleted = 0;
    for (const row of screen.list.rows) {
      switch (row.PaiEstReg) {
        case EST_A:
          active += 1;
          break;
        case EST_I:
          inactive += 1;
          break;
        case EST_X:
          deleted += 1;
          break;
      }
    }
    return { active, inactive, deleted };
  }, [screen.list.rows]);

  const applySingleStateFilter = React.useCallback(
    (target: EstReg | "ALL") => {
      if (target === "ALL") {
        if (screen.simpleInput.trim().length > 0) {
          screen.list.applySimpleSearch(screen.simpleInput);
        } else {
          screen.list.clearSearch();
        }
        return;
      }
      screen.list.applyAdvancedSearch({
        ...screen.list.advancedFilters,
        EstReg: [target],
      });
    },
    [screen.list, screen.simpleInput],
  );

  const activeSingleStateFilter = React.useMemo<EstReg | "ALL">(() => {
    const subset = screen.list.advancedFilters.EstReg;
    if (!Array.isArray(subset) || subset.length !== 1) {
      return "ALL";
    }
    const only = subset[0];
    if (only === EST_A || only === EST_I || only === EST_X) {
      return only;
    }
    return "ALL";
  }, [screen.list.advancedFilters.EstReg]);

  return {
    config: paisConfig,
    screen,
    stateCounts,
    activeSingleStateFilter,
    applySingleStateFilter,
  };
}
