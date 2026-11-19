import {
  createMicroform,
  defineControl,
  type FieldRendererProps,
  type FieldType,
  type InferMicroformType,
  type MicroformStructure,
  type QuerySource,
  type SelectOption,
} from "@microx-technologies/microform";
import {
  createStructForm,
  type FormFieldsItemArgs,
  InferFieldInput,
  useAsyncQuery,
} from "@microx-technologies/microform/react";
import { cn } from "cn";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale/es";
import {
  CalendarIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  SearchIcon,
} from "lucide-react";
import * as React from "react";
import type { FieldPath, FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BaseControlProps {
  placeholder?: string;
  readonly?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

interface SelectControlProps extends BaseControlProps {
  options?: SelectOption[];
}

interface CalendarControlProps extends BaseControlProps {
  label?: string;
  minDate?: string;
  maxDate?: string;
}

interface AsyncComboboxControlProps extends BaseControlProps {
  label?: string;
  asyncSource?: QuerySource<SelectOption>;
  emptyMessage?: string;
  valueType?: "string" | "number";
  resolveLabel?: (value: string | number) => Promise<string | undefined>;
}

function CalendarControl({
  value,
  onChange,
  onBlur,
  disabled,
  name,
  props,
}: FieldRendererProps<CalendarControlProps, string>) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  const minDate = React.useMemo(() => {
    if (!props.minDate) return undefined;
    const parsed = parseISO(props.minDate);
    return isValid(parsed) ? parsed : undefined;
  }, [props.minDate]);

  const maxDate = React.useMemo(() => {
    if (!props.maxDate) return undefined;
    const parsed = parseISO(props.maxDate);
    return isValid(parsed) ? parsed : undefined;
  }, [props.maxDate]);

  const disabledMatchers = React.useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  return (
    <>
      <Button
        id={name}
        data-testid={name ? `calendar-trigger-${name}` : undefined}
        type="button"
        variant="outline"
        disabled={disabled || props.readonly}
        aria-invalid={props.invalid || undefined}
        aria-describedby={props.ariaDescribedBy}
        onClick={() => setOpen(true)}
        className={cn(
          "h-11 min-h-11 w-full justify-between px-3 font-normal",
          !selectedDate && "text-muted-foreground",
        )}
      >
        <span>
          {selectedDate
            ? format(selectedDate, "dd/MM/yyyy", { locale: es })
            : (props.placeholder ?? "Seleccionar fecha")}
        </span>
        <CalendarIcon className="size-4 opacity-60" />
      </Button>

      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) onBlur?.();
        }}
      >
        <DrawerContent initialBreakpoint={0.75} breakpoints={[0, 0.75, 0.9]}>
          <DrawerHeader>
            <DrawerTitle>{props.label ?? "Seleccionar fecha"}</DrawerTitle>
            <DrawerDescription>
              Elige una fecha en el calendario
            </DrawerDescription>
          </DrawerHeader>
          <div
            data-testid={name ? `calendar-panel-${name}` : undefined}
            className="space-y-3 pb-2"
          >
            <div className="flex justify-center">
              <Calendar
                mode="single"
                locale={es}
                captionLayout="dropdown"
                startMonth={minDate ?? new Date(1920, 0, 1)}
                endMonth={maxDate ?? new Date()}
                selected={selectedDate}
                defaultMonth={selectedDate ?? maxDate}
                disabled={disabledMatchers}
                onSelect={(day) => {
                  onChange?.(day ? format(day, "yyyy-MM-dd") : undefined);
                  setOpen(false);
                  onBlur?.();
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11"
              data-testid={name ? `calendar-cancelar-${name}` : undefined}
              onClick={() => {
                setOpen(false);
                onBlur?.();
              }}
            >
              Cancelar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function AsyncComboboxControl({
  value,
  onChange,
  onBlur,
  disabled,
  name,
  props,
}: FieldRendererProps<AsyncComboboxControlProps, string | number>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedEntry, setSelectedEntry] = React.useState<
    { value: string; label: string } | undefined
  >(undefined);

  const fallbackSource = React.useMemo<QuerySource<SelectOption>>(
    () => ({
      fetch: async () => ({ items: [], total: 0 }),
    }),
    [],
  );

  const { data: options, isLoading } = useAsyncQuery({
    source: props.asyncSource ?? fallbackSource,
    search,
    page: 1,
    pageSize: 100,
    debounceMs: 200,
    enabled: open && Boolean(props.asyncSource),
  });

  const currentValue =
    value !== undefined && value !== null && String(value) !== ""
      ? String(value)
      : "";

  const matchedOption = options.find((opt) => opt.value === currentValue);
  const resolveLabelFn = props.resolveLabel;

  React.useEffect(() => {
    if (!currentValue || matchedOption?.label) {
      return;
    }
    if (selectedEntry?.value === currentValue) {
      return;
    }
    if (!resolveLabelFn) {
      return;
    }

    const numericValue = Number(currentValue);
    const resolvedInput =
      props.valueType === "number" && Number.isFinite(numericValue)
        ? numericValue
        : currentValue;

    let active = true;
    void resolveLabelFn(resolvedInput).then(
      (resolved) => {
        if (active && resolved) {
          setSelectedEntry({ value: currentValue, label: resolved });
        }
      },
      () => undefined,
    );

    return () => {
      active = false;
    };
  }, [
    currentValue,
    matchedOption?.label,
    props.valueType,
    resolveLabelFn,
    selectedEntry?.value,
  ]);

  const cachedLabel =
    selectedEntry?.value === currentValue ? selectedEntry.label : undefined;

  const displayLabel =
    matchedOption?.label ??
    (currentValue ? (cachedLabel ?? currentValue) : undefined);

  const closeWithoutSelection = () => {
    setOpen(false);
    setSearch("");
    onBlur?.();
  };

  const selectOption = (option: SelectOption) => {
    const numeric = Number(option.value);
    const nextValue =
      props.valueType === "number" && Number.isFinite(numeric)
        ? numeric
        : option.value;
    setSelectedEntry({ value: option.value, label: option.label });
    onChange?.(nextValue);
    closeWithoutSelection();
  };

  return (
    <>
      <Button
        id={name}
        data-testid={name ? `gsel-trigger-${name}` : undefined}
        type="button"
        variant="outline"
        disabled={disabled || props.readonly}
        aria-invalid={props.invalid || undefined}
        aria-describedby={props.ariaDescribedBy}
        onClick={() => setOpen(true)}
        className={cn(
          "h-11 min-h-11 w-full justify-between px-3 font-normal",
          !displayLabel && "text-muted-foreground",
        )}
      >
        <span className="truncate">
          {displayLabel ?? props.placeholder ?? "Seleccionar"}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 opacity-60" />
      </Button>

      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setOpen(true);
            return;
          }
          closeWithoutSelection();
        }}
      >
        <DrawerContent
          initialBreakpoint={0.75}
          breakpoints={[0, 0.5, 0.75, 0.95]}
        >
          <DrawerHeader>
            <DrawerTitle>{props.label ?? "Seleccionar"}</DrawerTitle>
          </DrawerHeader>
          <div
            data-testid={name ? `gsel-panel-${name}` : undefined}
            className="flex min-h-0 flex-col gap-3"
          >
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                name={name ? `${name}-search` : undefined}
                type="search"
                value={search}
                placeholder="Buscar por nombre..."
                aria-label="Buscar por nombre"
                data-testid={name ? `gsel-search-${name}` : undefined}
                onChange={(event) => setSearch(event.target.value)}
                className="flex h-11 min-h-11 w-full rounded-md border border-input bg-transparent py-2 pr-3 pl-9 text-sm font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <div
              role="listbox"
              aria-label={props.label ?? "Seleccionar"}
              className="flex max-h-[42dvh] min-h-0 flex-col divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border bg-card"
            >
              {options.length === 0 ? (
                <p
                  role="status"
                  className="m-0 px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {isLoading
                    ? "Buscando..."
                    : (props.emptyMessage ?? "Sin registros activos")}
                </p>
              ) : (
                options.map((option) => {
                  const isSelected = option.value === currentValue;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-testid={
                        name ? `gsel-option-${name}-${option.value}` : undefined
                      }
                      onClick={() => selectOption(option)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 px-3 py-3 text-left text-sm text-foreground transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-muted/50",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {option.label}
                      </span>
                      <CheckIcon
                        aria-hidden="true"
                        className={cn(
                          "size-4 shrink-0",
                          isSelected
                            ? "text-foreground opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <DrawerFooter className="px-0">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 w-full text-sm font-medium"
              data-testid={name ? `gsel-cancelar-${name}` : undefined}
              onClick={closeWithoutSelection}
            >
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

const textControl = defineControl({
  type: "text",
  renderer: ({
    value,
    onChange,
    onBlur,
    disabled,
    name,
    props,
  }: FieldRendererProps<BaseControlProps, string>) => (
    <Input
      id={name}
      name={name}
      type="text"
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      readOnly={props.readonly}
      maxLength={props.maxLength}
      inputMode={props.inputMode}
      placeholder={props.placeholder}
      aria-invalid={props.invalid || undefined}
      aria-describedby={props.ariaDescribedBy}
      className="h-11 min-h-11 text-sm"
    />
  ),
});

const numberControl = defineControl({
  type: "number",
  renderer: ({
    value,
    onChange,
    onBlur,
    disabled,
    name,
    props,
  }: FieldRendererProps<BaseControlProps, number>) => (
    <Input
      id={name}
      name={name}
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      onChange={(event) => {
        const raw = event.target.value;
        onChange?.(raw === "" ? undefined : Number(raw));
      }}
      onBlur={onBlur}
      disabled={disabled}
      readOnly={props.readonly}
      placeholder={props.placeholder}
      aria-invalid={props.invalid || undefined}
      aria-describedby={props.ariaDescribedBy}
      className="h-11 min-h-11 text-sm"
    />
  ),
});

const selectControl = defineControl({
  type: "select",
  renderer: ({
    value,
    onChange,
    onBlur,
    disabled,
    name,
    props,
  }: FieldRendererProps<SelectControlProps, string>) => (
    <Select
      value={value !== undefined ? String(value) : undefined}
      onValueChange={(nextValue) => {
        onChange?.(nextValue);
        onBlur?.();
      }}
      disabled={disabled || props.readonly}
    >
      <SelectTrigger
        id={name}
        aria-invalid={props.invalid || undefined}
        aria-describedby={props.ariaDescribedBy}
      >
        <SelectValue placeholder={props.placeholder ?? "Seleccionar"} />
      </SelectTrigger>
      <SelectContent>
        {(props.options ?? []).map((option) => (
          <SelectItem key={option.key} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
});

const calendarControl = defineControl({
  type: "calendar",
  renderer: (context: FieldRendererProps<CalendarControlProps, string>) => (
    <CalendarControl {...context} />
  ),
});

const asyncComboboxControl = defineControl({
  type: "async_combobox",
  renderer: (
    context: FieldRendererProps<AsyncComboboxControlProps, string | number>,
  ) => <AsyncComboboxControl {...context} />,
});

export const microform = createMicroform({
  controls: [
    textControl,
    numberControl,
    selectControl,
    calendarControl,
    asyncComboboxControl,
  ],
});

export type AppStructure<
  TName extends string,
  TValues = Record<string, unknown>,
> = MicroformStructure<typeof microform, TName, TValues>;

function renderMicroformItem<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  field: FieldType<TName, InferMicroformType<typeof microform>, TFieldValues>,
  {
    rhf,
    fieldState,
    required,
    invalid,
    disabled,
  }: FormFieldsItemArgs<TFieldValues, TName>,
) {
  const errorMessage = fieldState.error?.message;
  const descId = field.description ? `${rhf.name}-description` : undefined;
  const errorId = errorMessage ? `${rhf.name}-error` : undefined;
  const ariaDescribedBy =
    [descId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={rhf.name}
        className="gap-0.5 text-xs font-medium text-foreground"
      >
        <span>{field.label}</span>
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>

      <InferFieldInput
        type={field.type}
        name={rhf.name}
        value={rhf.value}
        onChange={rhf.onChange}
        onBlur={rhf.onBlur}
        disabled={disabled}
        fieldProps={{ ...field, invalid, ariaDescribedBy }}
      />

      {field.description && (
        <p id={descId} className="m-0 text-xs text-muted-foreground">
          {field.description}
        </p>
      )}

      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="m-0 text-xs font-medium text-destructive"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export const AppStructForm = createStructForm({
  microform,
  renderItem: renderMicroformItem,
  classNames: { row: "gap-x-2.5 gap-y-2.5", section: "gap-2.5" },
  formClassName: "space-y-2.5",
});
