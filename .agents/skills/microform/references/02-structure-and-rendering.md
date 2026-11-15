# Layout Structures & Dynamic Rendering

`microform` defines forms as typed structural graphs (`FieldStructure`), separating layout topology from HTML markup.

## 1. Declaring a `FieldStructure`

Layouts organize fields into **sections**, **rows**, and **columns** using a 12-column grid budget:

```tsx
import type { FieldStructure } from "microform";

export type UserFormValues = {
  fullName: string;
  age: number;
  email: string;
  bio?: string;
};

export const userStructure: FieldStructure<keyof UserFormValues> = [
  {
    kind: "section",
    key: "personal",
    title: "Personal Information",
    description: "Primary contact details",
    children: [
      {
        fields: [
          {
            type: "text",
            name: "fullName",
            label: "Full Name",
            colspan: 8, // 8 / 12 columns
          },
          {
            type: "number",
            name: "age",
            label: "Age",
            colspan: 4, // 4 / 12 columns (8 + 4 = 12)
          },
        ],
      },
      {
        type: "email",
        name: "email",
        label: "Email Address",
        // Unset colspan defaults to 12
      },
    ],
  },
  {
    type: "textarea",
    name: "bio",
    label: "Biography",
  },
];
```

---

## 2. Rendering with `MicroformProvider` and `FormFields`

Binds React Hook Form to the structure. `renderItem` maps each field definition into UI markup and calls `InferFieldInput`:

```tsx
import { useForm } from "react-hook-form";
import { createFormDefaults } from "@microx-technologies/microform";
import { FormFields, InferFieldInput, MicroformProvider } from "@microx-technologies/microform/react";
import { microform } from "./microform-setup";
import { userSchema, userStructure, type UserFormValues } from "./schema";

export function UserForm() {
  const form = useForm<UserFormValues>({
    defaultValues: createFormDefaults(userSchema),
  });

  return (
    <MicroformProvider value={microform}>
      <FormFields
        structure={userStructure}
        control={form.control}
        schema={userSchema}
        renderItem={(field, { rhf, fieldState, required }) => (
          <div className="space-y-1.5">
            <label htmlFor={rhf.name} className="text-sm font-medium">
              {field.label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            <InferFieldInput
              type={field.type}
              name={rhf.name}
              value={rhf.value}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
              disabled={field.disabled}
              fieldProps={field}
            />

            {field.description && (
              <p className="text-xs text-zinc-500">{field.description}</p>
            )}

            {fieldState.error && (
              <p className="text-xs text-red-500">{fieldState.error.message}</p>
            )}
          </div>
        )}
      />
    </MicroformProvider>
  );
}
```

---

## 3. Tailwind CSS Grid Layout by Default

`FieldGrid` renders with `preset="tailwind"` by default, emitting static classes `grid grid-cols-12 gap-4 items-start`, `col-span-1` through `col-span-12`, and `w-full` without manual CSS rules.

To opt out and use raw CSS data attributes exclusively:

```tsx
<FormFields
  structure={userStructure}
  control={form.control}
  preset="data-attrs"
  renderItem={...}
/>
```

---

## 4. High-Level Form Wrapper (`StructForm`)

Prefer `StructForm` over manual `<form>` + `FormFields` in nearly every submit form. State from the library, pixels from userland (the framework never ships styled buttons):

```tsx
import { StructForm } from "microform/react";

<MicroformProvider value={microform}>
  <StructForm
    structure={userStructure}
    form={form}
    schema={userSchema}
    onSubmit={onSubmit}
    renderItem={(field, { rhf, required }) => (
      <InferFieldInput
        type={field.type}
        name={rhf.name}
        value={rhf.value}
        onChange={rhf.onChange}
      />
    )}
    formProps={{ className: "space-y-6" }}
    renderSubmit={({ disabled, isSubmitting }) => (
      <button type="submit" disabled={disabled} aria-busy={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save Changes"}
      </button>
    )}
  />
</MicroformProvider>
```

- `renderSubmit({ isSubmitting, disabled })`: no manual `useState` loading — `disabled` already merges the prop with `isSubmitting`.
- `formProps` spreads onto `<form>`; `onSubmit` always wins.
- Gotchas: `submitMode="auto"` only hides the button (drive auto-submit via `watch`, outside `StructForm`); the bare `<button>` fallback renders solely when `renderSubmit` is absent — legacy, never use it in new code.

---

## 5. App Shell (`createStructForm`, >= 1.3.0)

Never repeat `MicroformProvider` + `renderItem` + spacing props per form. Resolve ONE `AppStructForm` next to the registry — provider, item renderer, and spacing policy in a single config:

```tsx
import { createStructForm } from "@microx-technologies/microform/react";
import { renderMicroformItem } from "@/libs/microform/render-item";
import { microform } from "@/libs/microform/setup";

export const AppStructForm = createStructForm({
  microform,
  renderItem: renderMicroformItem,
  classNames: { row: "gap-x-4 gap-y-8", section: "gap-8" },
  formClassName: "space-y-8",
});
```

Every submit form consumes it with full inference; explicit per-use props merge over factory defaults via `tailwind-merge`:

```tsx
<AppStructForm
  structure={userStructure}
  form={form}
  schema={userSchema}
  onSubmit={onSubmit}
  renderSubmit={({ disabled, isSubmitting }) => (
    <button type="submit" disabled={disabled} aria-busy={isSubmitting}>
      {isSubmitting ? "Saving…" : "Save Changes"}
    </button>
  )}
/>
```

- `classNames={{ row, section }}` (>= 1.2.0): merged over the Tailwind grid defaults (`gap-4` rows, `gap-5` sections); custom wins on conflict, split axes supported (`gap-x-4 gap-y-8`).
- Rows render as siblings (no wrapper), so the rhythm *between* rows lives on `<form>` via `formClassName` / `formProps.className`.
- Compact exception: `formProps={{ className: "flex flex-col gap-2 space-y-0" }}` keeps a dense layout while neutralizing the global rhythm.
