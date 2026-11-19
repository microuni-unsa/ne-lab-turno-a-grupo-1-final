import type { TextFieldTypes } from "@ionic/core";
import { IonInput } from "@ionic/react";
import { cn } from "cn";
import * as React from "react";
import {
  assignElementRef,
  type CommonIonicWrapperProps,
  extractCommonDomProps,
  useIonicForwardedRef,
} from "@/components/ui/ionic-props";

export interface InputChangeEvent {
  readonly target: {
    readonly value: string;
    readonly name: string;
  };
  readonly currentTarget: {
    readonly value: string;
    readonly name: string;
  };
}

type InputProps = Omit<CommonIonicWrapperProps, "children"> & {
  type?: React.HTMLInputTypeAttribute;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  onChange?: (event: InputChangeEvent) => void;
  readOnly?: boolean;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: React.ComponentProps<typeof IonInput>["autocomplete"];
  name?: string;
  pattern?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoFocus?: boolean;
  ref?: React.Ref<HTMLIonInputElement>;
};

function toIonInputValue(
  raw: string | number | readonly string[] | undefined,
): string | number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "string" || typeof raw === "number") return raw;
  return raw.join(",");
}

function toIonicInputType(type: string | undefined): TextFieldTypes {
  switch (type) {
    case "date":
    case "datetime-local":
    case "email":
    case "month":
    case "number":
    case "password":
    case "search":
    case "tel":
    case "text":
    case "time":
    case "url":
    case "week":
      return type;
    default:
      return "text";
  }
}

function toSyntheticChangeEvent(
  value: string,
  name: string | undefined,
): InputChangeEvent {
  const target = { value, name: name ?? "" };
  return {
    target,
    currentTarget: target,
  };
}

function Input({
  className,
  type = "text",
  value,
  defaultValue,
  onChange,
  readOnly,
  disabled,
  required,
  maxLength,
  minLength,
  placeholder,
  inputMode,
  autoComplete,
  name,
  pattern,
  min,
  max,
  step,
  autoFocus,
  ref,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const elementRef = React.useRef<HTMLIonInputElement | null>(null);
  const initializedDefaultRef = React.useRef(false);
  const forwardedIonicRef = useIonicForwardedRef<HTMLIonInputElement>(
    React.useCallback(
      (node: HTMLIonInputElement | null) => {
        elementRef.current = node;
        assignElementRef(ref, node);
      },
      [ref],
    ),
    {
      ...props,
      "aria-invalid": ariaInvalid,
    },
  );
  const isInvalid = ariaInvalid === true || ariaInvalid === "true";

  const controlledValue =
    value !== undefined ? toIonInputValue(value) : undefined;

  React.useLayoutEffect(() => {
    if (initializedDefaultRef.current || value !== undefined) {
      return;
    }
    const element = elementRef.current;
    const initial = toIonInputValue(defaultValue);
    if (element && initial !== undefined) {
      element.value = initial;
      initializedDefaultRef.current = true;
    }
  }, [defaultValue, value]);

  return (
    <IonInput
      ref={forwardedIonicRef}
      data-slot="input"
      type={toIonicInputType(type)}
      name={name}
      value={controlledValue}
      readonly={readOnly}
      disabled={disabled}
      required={required}
      maxlength={maxLength}
      minlength={minLength}
      placeholder={placeholder}
      inputmode={inputMode}
      autocomplete={autoComplete}
      pattern={pattern}
      min={min}
      max={max}
      step={step !== undefined ? String(step) : undefined}
      autofocus={autoFocus}
      aria-invalid={ariaInvalid}
      onIonInput={(event) => {
        if (!onChange) return;
        const nextValue = String(event.detail.value ?? "");
        onChange(toSyntheticChangeEvent(nextValue, name));
      }}
      className={cn(
        "maestro-input h-11 min-h-11 w-full min-w-0 rounded-md bg-transparent text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        isInvalid && "ion-invalid ion-touched",
        className,
      )}
      {...extractCommonDomProps(props)}
    />
  );
}

export type { InputProps };
export { Input };
