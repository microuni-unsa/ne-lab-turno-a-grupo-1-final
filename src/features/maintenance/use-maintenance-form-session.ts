import { cleanVars } from "@microx-technologies/microform";
import * as React from "react";
import type {
  FieldErrors,
  FieldValues,
  Path,
  UseFormReturn,
} from "react-hook-form";
import type { FieldFailure } from "@/core";
import { applyFieldFailuresToForm } from "@/features/maintenance/use-maintenance-controller";

/**
 * Safely copies own enumerable properties from an unknown record into a plain
 * dictionary without introducing `any` from `Object.entries`.
 */
export function toPlainRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    out[key] = Object.getOwnPropertyDescriptor(raw, key)?.value;
  }
  return out;
}

export interface UseMaintenanceFormSessionOptions<
  TFieldValues extends FieldValues,
> {
  readonly form: UseFormReturn<TFieldValues>;
  readonly externalFailures: readonly FieldFailure[];
  readonly submitTriggerRef: React.MutableRefObject<(() => void) | null>;
  readonly onDraftChange: (nextDraft: Record<string, unknown>) => void;
  readonly validateCleaned: (
    cleaned: Record<string, unknown>,
  ) => readonly FieldFailure[];
  readonly toFieldPath: (fieldName: string) => Path<TFieldValues> | null;
  readonly onSubmitPayload: (
    payload: Record<string, unknown>,
  ) => Promise<boolean>;
  readonly onNotifyBatchErrors: (failures: readonly FieldFailure[]) => void;
}

/**
 * Shared React Hook Form session wiring for Maintenance form drawers:
 * draft synchronization, external domain error application, R22 batch
 * validation (`validateCleaned`), and `submitTriggerRef` coordination.
 */
export function useMaintenanceFormSession<TFieldValues extends FieldValues>({
  form,
  externalFailures,
  submitTriggerRef,
  onDraftChange,
  validateCleaned,
  toFieldPath,
  onSubmitPayload,
  onNotifyBatchErrors,
}: UseMaintenanceFormSessionOptions<TFieldValues>) {
  React.useEffect(() => {
    const subscription = form.watch((values, info) => {
      if (info.name) {
        const path = toFieldPath(info.name);
        if (path !== null) {
          form.clearErrors(path);
        }
      }
      onDraftChange(toPlainRecord(values));
    });
    return () => subscription.unsubscribe();
  }, [form, onDraftChange, toFieldPath]);

  React.useEffect(() => {
    if (externalFailures.length === 0) {
      return;
    }
    applyFieldFailuresToForm(externalFailures, (fieldName, message) => {
      const path = toFieldPath(fieldName);
      if (path !== null) {
        form.setError(path, { type: "domain", message });
      }
    });
  }, [externalFailures, form, toFieldPath]);

  const handleValid = React.useCallback(
    async (rawValues: TFieldValues) => {
      const cleaned = cleanVars(toPlainRecord(rawValues)) ?? {};
      const failures = validateCleaned(cleaned);
      if (failures.length > 0) {
        applyFieldFailuresToForm(failures, (fieldName, message) => {
          const path = toFieldPath(fieldName);
          if (path !== null) {
            form.setError(path, { type: "domain", message });
          }
        });
        onNotifyBatchErrors(failures);
        return;
      }
      await onSubmitPayload(cleaned);
    },
    [form, onNotifyBatchErrors, onSubmitPayload, toFieldPath, validateCleaned],
  );

  const handleInvalid = React.useCallback(
    (fieldErrors: FieldErrors<TFieldValues>) => {
      const cleaned = cleanVars(toPlainRecord(form.getValues())) ?? {};
      const failures = validateCleaned(cleaned);
      if (failures.length > 0) {
        applyFieldFailuresToForm(failures, (fieldName, message) => {
          const path = toFieldPath(fieldName);
          if (path !== null) {
            form.setError(path, { type: "domain", message });
          }
        });
        onNotifyBatchErrors(failures);
        return;
      }

      for (const fieldName of Object.keys(fieldErrors)) {
        const errRaw = Object.getOwnPropertyDescriptor(
          fieldErrors,
          fieldName,
        )?.value;
        const msg =
          typeof errRaw === "object" && errRaw !== null
            ? Reflect.get(errRaw, "message")
            : undefined;
        const path = toFieldPath(fieldName);
        if (path !== null && typeof msg === "string") {
          form.setError(path, { type: "manual", message: msg });
        }
      }
    },
    [form, onNotifyBatchErrors, toFieldPath, validateCleaned],
  );

  const triggerSubmit = React.useCallback(() => {
    void form.handleSubmit(handleValid, handleInvalid)();
  }, [form, handleInvalid, handleValid]);

  React.useEffect(() => {
    submitTriggerRef.current = triggerSubmit;
    return () => {
      if (submitTriggerRef.current === triggerSubmit) {
        submitTriggerRef.current = null;
      }
    };
  }, [submitTriggerRef, triggerSubmit]);

  return {
    handleValid,
    handleInvalid,
    triggerSubmit,
  };
}
