import { describe, expect, it } from "vitest";
import { analyzeStaticRules } from "@/test/static-rules";

describe("analyzeStaticRules guard", () => {
  it("rejects inline TypeScript import(...).Type syntax", () => {
    const sample = [
      'import type { ReactNode } from "react";',
      'type Bad = import("@microx-technologies/microform").FieldType;',
    ].join("\n");

    const violations = analyzeStaticRules("src/example.ts", sample);
    expect(violations.some((v) => v.rule === "no-inline-import-type")).toBe(
      true,
    );
  });

  it("rejects ambient declare function bridge helpers", () => {
    const sample =
      "declare function FormFieldsItemTypeHelper(x: string): string;";
    const violations = analyzeStaticRules("src/example.ts", sample);
    expect(violations.some((v) => v.rule === "no-declare-function")).toBe(true);
  });

  it("rejects dynamic import(...) and relative imports", () => {
    const sample = 'const lazy = await import("./x");';
    const violations = analyzeStaticRules("src/example.ts", sample);
    expect(violations.some((v) => v.rule === "no-dynamic-import")).toBe(true);
    expect(violations.some((v) => v.rule === "no-relative-import")).toBe(true);
  });

  it("rejects unsafe as unknown as and as Record<...> casts", () => {
    const sample = [
      "const a = value as unknown as Foo;",
      "const b = obj as Record<string, unknown>;",
    ].join("\n");
    const violations = analyzeStaticRules("src/example.ts", sample);
    expect(
      violations.filter((v) => v.rule === "no-unsafe-as-cast").length,
    ).toBe(2);
  });

  it("rejects explicit any (including type aliases), postfix non-null assertions, and @ts suppression comments", () => {
    const sample = [
      "// @ts-ignore",
      "/* @ts-expect-error */",
      "// @ts-nocheck",
      "type AliasAny = any;",
      "const bad = (x: any): AliasAny => x!.name;",
      'const mod = require("./legacy");',
    ].join("\n");
    const violations = analyzeStaticRules("src/example.ts", sample);
    expect(
      violations.filter((v) => v.rule === "no-ts-suppression").length,
    ).toBe(3);
    expect(violations.filter((v) => v.rule === "no-explicit-any").length).toBe(
      2,
    );
    expect(violations.some((v) => v.rule === "no-non-null-assertion")).toBe(
      true,
    );
    expect(violations.some((v) => v.rule === "no-require")).toBe(true);
  });

  it("rejects Ionic Tailwind arbitrary custom properties like [--background:transparent] and [--border-radius:8px] in .tsx", () => {
    const sample = [
      "export function Bad() {",
      "  return (",
      "    <div>",
      '      <button className="[--background:transparent]" />',
      '      <button className="[--border-radius:8px]" />',
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const violations = analyzeStaticRules("src/Bad.tsx", sample);
    expect(
      violations.filter((v) => v.rule === "no-ionic-arbitrary-css-var").length,
    ).toBe(2);
  });

  it("accepts clean static imports, algebraic guards, valid negation, and Spanish JSX prose with !", () => {
    const sample = [
      'import type { FieldType } from "@microx-technologies/microform";',
      'import { cn } from "cn";',
      "export function ok(flag: boolean, item: { name?: string } | null) {",
      "  if (!flag && item != null && item.name !== undefined) {",
      '    return <span className={cn(item.name, "text-sm")}>Guardado! Verifica datos</span>;',
      "  }",
      "  return null;",
      "}",
    ].join("\n");

    const violations = analyzeStaticRules("src/Clean.tsx", sample);
    expect(violations).toEqual([]);
  });
});
