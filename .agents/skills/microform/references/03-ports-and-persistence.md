# Draft Persistence & Storage Ports

`microform` uses a Ports and Adapters pattern for persistence, decoupling storage drivers (`localStorage`, `sessionStorage`, `IndexedDB`, or in-memory test mocks) from form components.

## 1. StorageAdapter Port

Any storage engine implements `StorageAdapter`:

```ts
import type { StorageAdapter } from "microform";

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    get: (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    remove: (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}
```

> **Testing**: `@microx-technologies/microform` exports `createMemoryStorage({ [key]: value })` for headless or unit test suites without DOM APIs.

---

## 2. Pure Draft Restoration with `readPersistedValues`

Avoid visual flashing and unwanted `isDirty: true` flags by injecting drafts synchronously into `defaultValues`:

```tsx
import { useForm } from "react-hook-form";
import { createFormDefaults, readPersistedValues, clearPersistedValues } from "@microx-technologies/microform";
import { userSchema, userStructure, type UserFormValues } from "./schema";
import { storage } from "./storage";

export function UserForm() {
  const defaultValues = {
    ...createFormDefaults(userSchema),
    ...readPersistedValues<UserFormValues>(userStructure, storage),
  };

  const form = useForm<UserFormValues>({ defaultValues });

  const onReset = () => {
    clearPersistedValues(userStructure, storage);
    form.reset();
  };

  return ( ... );
}
```

---

## 3. Automatic Field Sync via `usePersistence`

Binds a specific field to storage to record changes while typing:

```tsx
usePersistence({
  control: form.control,
  name: "name",
  storage,
  persistKey: "draft_user_name",
  restoreOnMount: false, // Drafts were already injected via defaultValues
});
```

### `usePersistence` Parameters:
- `control`: React Hook Form `control` instance.
- `name`: Target field name.
- `storage`: `StorageAdapter` implementation.
- `persistKey`: Unique storage identifier.
- `prefix`: Key prefix (defaults to `"form-persist:"`).
- `onRestore`: Invoked on mount if a persisted value is found.
- `restoreOnMount`: Set to `false` when using `readPersistedValues` to prevent late mount restoration.
