import { IonCheckbox } from "@ionic/react";
import { cn } from "cn";
import type * as React from "react";
import {
  type CommonIonicWrapperProps,
  extractCommonDomProps,
  useIonicForwardedRef,
} from "@/components/ui/ionic-props";

type CheckedState = boolean | "indeterminate";

type CheckboxProps = CommonIonicWrapperProps & {
  checked?: CheckedState;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: CheckedState) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  ref?: React.Ref<HTMLIonCheckboxElement>;
};

function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  required,
  name,
  "aria-invalid": ariaInvalid,
  ref,
  children,
  ...props
}: CheckboxProps) {
  const ionicRef = useIonicForwardedRef<HTMLIonCheckboxElement>(ref, {
    ...props,
    "aria-invalid": ariaInvalid,
  });
  const isIndeterminate = checked === "indeterminate";
  const isChecked =
    checked !== undefined ? checked === true : Boolean(defaultChecked);

  return (
    <IonCheckbox
      ref={ionicRef}
      data-slot="checkbox"
      name={name}
      checked={isChecked}
      indeterminate={isIndeterminate}
      disabled={disabled}
      required={required}
      aria-invalid={ariaInvalid}
      onIonChange={(event) => {
        onCheckedChange?.(event.detail.checked);
      }}
      className={cn(
        "peer inline-flex size-5 shrink-0 items-center justify-center rounded-[4px]",
        className,
      )}
      {...extractCommonDomProps(props)}
    >
      {children}
    </IonCheckbox>
  );
}

export type { CheckboxProps, CheckedState };
export { Checkbox };
