import * as React from "react";

export interface DataAttributeProps {
  [key: `data-${string}`]: string | number | boolean | undefined;
}

export interface CommonIonicWrapperProps
  extends React.AriaAttributes,
    DataAttributeProps {
  id?: string;
  title?: string;
  role?: React.AriaRole;
  tabIndex?: number;
  hidden?: boolean;
  dir?: string;
  lang?: string;
  slot?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onBlur?: React.FocusEventHandler<HTMLElement>;
  onFocus?: React.FocusEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
}

const syncedAttributeKeys = new WeakMap<HTMLElement, Set<string>>();

export function toIonicStyle(
  style: React.CSSProperties | undefined,
): Record<string, string | number> | undefined {
  if (!style) {
    return undefined;
  }
  const entries: Array<[string, string | number]> = [];
  for (const key of Object.keys(style)) {
    const value: unknown = Object.getOwnPropertyDescriptor(style, key)?.value;
    if (typeof value === "string" || typeof value === "number") {
      entries.push([key, value]);
    }
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function extractCommonDomProps(props: CommonIonicWrapperProps) {
  return {
    id: props.id,
    title: props.title,
    role: props.role,
    tabIndex: props.tabIndex,
    hidden: props.hidden,
    dir: props.dir,
    lang: props.lang,
    slot: props.slot,
    style: toIonicStyle(props.style),
    onClick: props.onClick,
    onBlur: props.onBlur,
    onFocus: props.onFocus,
    onKeyDown: props.onKeyDown,
    onKeyUp: props.onKeyUp,
    onMouseEnter: props.onMouseEnter,
    onMouseLeave: props.onMouseLeave,
  };
}

export function syncForwardedAttributes(
  element: HTMLElement | null,
  source: object,
): void {
  if (!element) {
    return;
  }

  const nextKeys = new Set<string>();
  for (const key of Object.keys(source)) {
    if (!key.startsWith("data-") && !key.startsWith("aria-")) {
      continue;
    }
    const value: unknown = Object.getOwnPropertyDescriptor(source, key)?.value;
    if (value === undefined || value === null) {
      element.removeAttribute(key);
      continue;
    }
    if (key.startsWith("data-") && value === false) {
      element.removeAttribute(key);
      continue;
    }
    const serialized =
      key.startsWith("data-") && value === true ? "" : String(value);
    element.setAttribute(key, serialized);
    nextKeys.add(key);
  }

  const previousKeys = syncedAttributeKeys.get(element);
  if (previousKeys) {
    for (const oldKey of previousKeys) {
      if (!nextKeys.has(oldKey)) {
        element.removeAttribute(oldKey);
      }
    }
  }
  syncedAttributeKeys.set(element, nextKeys);
}

export function assignElementRef<T extends HTMLElement>(
  ref: React.Ref<T> | undefined,
  element: T | null,
): void {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(element);
    return;
  }
  ref.current = element;
}

function computeForwardedAttrSignature(source: object): string {
  const parts: string[] = [];
  for (const key of Object.keys(source).sort()) {
    if (key.startsWith("data-") || key.startsWith("aria-")) {
      const value: unknown = Object.getOwnPropertyDescriptor(
        source,
        key,
      )?.value;
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.join("|");
}

export function useIonicForwardedRef<
  TElement extends TForwarded,
  TForwarded extends HTMLElement = TElement,
>(
  forwardedRef: React.Ref<TForwarded> | undefined,
  attributeSource: object,
): React.RefCallback<TElement> {
  const elementRef = React.useRef<TElement | null>(null);
  const latestSourceRef = React.useRef<object>(attributeSource);
  latestSourceRef.current = attributeSource;
  const attrSignature = computeForwardedAttrSignature(attributeSource);

  React.useLayoutEffect(() => {
    void attrSignature;
    syncForwardedAttributes(elementRef.current, latestSourceRef.current);
  }, [attrSignature]);

  return React.useCallback(
    (node: TElement | null) => {
      elementRef.current = node;
      if (node) {
        syncForwardedAttributes(node, latestSourceRef.current);
      }
      assignElementRef(forwardedRef, node);
    },
    [forwardedRef],
  );
}
