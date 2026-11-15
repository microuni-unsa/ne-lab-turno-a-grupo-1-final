# Async Queries, Variable Cleaning, and Submit Flow

`microform` supplies architectural primitives for remote paginated data sources, recursive payload sanitization, and standardized mutation lifecycles.

## 1. Variable Sanitization (`cleanVars`)

Recursively cleans objects and arrays prior to mutation or query dispatch:

```ts
import { cleanVars } from "microform";

const raw = {
  search: "  Jane Doe  ",
  emptyField: "   ",
  score: 100,
};

// "null" mode: Blank strings become null (GraphQL / SQL mutations)
const forMutation = cleanVars(raw, { empty: "null" });
// { search: "Jane Doe", emptyField: null, score: 100 }

// "omit" mode (default): Blank strings are stripped (search params / URL filters)
const forQuery = cleanVars(raw);
// { search: "Jane Doe", score: 100 }
```

---

## 2. Paginated Remote Source with `createUrqlSource` + `useAsyncQuery`

Canonical path only: declare a `QuerySource<TItem>` with `createUrqlSource`,
consume with `useAsyncQuery({ source, search, page })`. `cleanVars` (omit)
runs inside the adapter; `AbortSignal` from `FetchArgs` is forwarded.

```tsx
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { createUrqlSource, type PersonOption, type QuerySource } from "microform";
import { useAsyncQuery } from "microform/react";
import { useState } from "react";
import { client } from "./gql-service";
import {
  StudentOptionsDocument,
  type StudentOptionsQuery,
  type StudentOptionsQueryVariables,
} from "./generated/gql.client";

// 1. Declare query port adapter (module scope, typed end-to-end)
export const studentSource: QuerySource<PersonOption> = createUrqlSource<
  PersonOption,
  StudentOptionsQueryVariables,
  StudentOptionsQuery
>({
  document: StudentOptionsDocument as TypedDocumentNode<
    StudentOptionsQuery,
    StudentOptionsQueryVariables
  >,
  client,
  toVariables: (search, page, pageSize) => ({
    take: pageSize,
    skip: (page - 1) * pageSize,
    filter: search ? { search: { contains: search } } : undefined,
  }),
  fromData: (data) => ({
    items: (data.students?.items ?? []).map((s) => ({
      key: s.id,
      value: s.id,
      label: `${s.user?.firstName ?? ""} ${s.user?.lastName ?? ""}`.trim(),
    })),
    total: data.students?.totalCount,
  }),
  pageSize: 20,
});

// 2. Consume in component
export function UserSearchSelect() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, total, isLoading, refetch } = useAsyncQuery({
    source: studentSource,
    search,
    page,
    pageSize: 20,
    debounceMs: 250,
  });

  return ( ... );
}
```

---

## 3. Standardized Mutation Orchestration (`handleSubmitFlow`)

Coordinates sanitization, execution, toast notifications, draft cleanup, and cache invalidation:

```ts
import { handleSubmitFlow } from "@microx-technologies/microform";
import type { NotifyAdapter } from "@microx-technologies/microform";
import { toast } from "sonner";
import { userStructure } from "./schema";
import { storage } from "./storage";

const notify: NotifyAdapter = {
  success: (msg) => toast.success(msg),
  error: (msg, detail) => toast.error(msg, { description: detail }),
};

const onSubmit = async (values: FormValues) => {
  const ok = await handleSubmitFlow<UserResponse, FormValues>({
    mutation: async (cleanedVars) => {
      return await api.updateUser(cleanedVars);
    },
    vars: values,
    notify,
    setIsLoading,
    clearPersistence: true,
    structure: userStructure,
    storage,
    successMessage: "User profile updated",
    resetForm: () => form.reset(),
    invalidate: () => refetchUserList(),
    onSuccess: (data) => {
      // Access typed response data
    },
  });

  if (ok) {
    // Navigate or close modal
  }
};
```

> `setIsLoading` is only for non-`StructForm` flows. Inside `StructForm`, read loading from `renderSubmit({ isSubmitting })` — RHF tracks the `onSubmit` promise window, so a manual flag would duplicate it.
