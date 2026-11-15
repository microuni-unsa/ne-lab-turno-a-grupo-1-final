export type StaticRuleId =
  | "no-dynamic-import"
  | "no-inline-import-type"
  | "no-require"
  | "no-declare-function"
  | "no-explicit-any"
  | "no-unsafe-as-cast"
  | "no-non-null-assertion"
  | "no-ts-suppression"
  | "no-ionic-arbitrary-css-var"
  | "no-relative-import";

export interface StaticViolation {
  readonly rule: StaticRuleId;
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly snippet: string;
}

type TokenKind = "word" | "number" | "punct" | "string" | "comment" | "regex";

interface LexToken {
  readonly kind: TokenKind;
  readonly value: string;
  readonly raw: string;
  readonly line: number;
}

const REGEX_PRECEDING_WORDS = new Set([
  "return",
  "case",
  "throw",
  "typeof",
  "void",
  "delete",
  "in",
  "of",
  "await",
  "yield",
  "else",
  "do",
  "new",
  "export",
  "default",
  "extends",
]);

const REGEX_PRECEDING_PUNCTS = new Set([
  "(",
  "[",
  "{",
  ",",
  ";",
  ":",
  "=",
  "!",
  "?",
  "&",
  "|",
  "^",
  "~",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "=>",
  "==",
  "===",
  "!=",
  "!==",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
]);

const UNARY_NEGATION_KEYWORDS = new Set([
  "return",
  "throw",
  "await",
  "typeof",
  "yield",
  "case",
  "delete",
  "void",
  "in",
  "of",
  "else",
  "do",
  "new",
  "export",
  "default",
]);

const ANY_PRECEDING_PUNCTS = new Set([":", "<", ",", "|", "&", "(", "="]);

const FORBIDDEN_IONIC_ARBITRARY_CSS_RE =
  /\[--(?:background|color|width|height|max-width|min-height|min-width|border-radius|ion-[a-z-]+|padding-[a-z-]+|margin-[a-z-]+|border-[a-z-]+|box-shadow|highlight-[a-z-]+|placeholder-[a-z-]+):/;

function isWordStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

function isWordContinue(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

function lastSignificantToken(
  tokens: readonly LexToken[],
): LexToken | undefined {
  for (let idx = tokens.length - 1; idx >= 0; idx -= 1) {
    const token = tokens[idx];
    if (token && token.kind !== "comment") {
      return token;
    }
  }
  return undefined;
}

function canPrecedeRegex(prev: LexToken | undefined): boolean {
  if (!prev) {
    return true;
  }
  if (prev.kind === "punct") {
    return REGEX_PRECEDING_PUNCTS.has(prev.value);
  }
  if (prev.kind === "word") {
    return REGEX_PRECEDING_WORDS.has(prev.value);
  }
  return false;
}

function readStringLiteral(
  source: string,
  start: number,
  quote: string,
  startLine: number,
): {
  readonly token: LexToken;
  readonly nextIndex: number;
  readonly line: number;
} {
  let idx = start + 1;
  let value = "";
  let line = startLine;

  while (idx < source.length) {
    const ch = source.charAt(idx);
    if (ch === "\\") {
      const next = source.charAt(idx + 1);
      if (next === "\n") {
        line += 1;
      }
      value += next;
      idx += 2;
      continue;
    }
    if (ch === quote) {
      idx += 1;
      break;
    }
    if (ch === "\n") {
      line += 1;
      idx += 1;
      break;
    }
    value += ch;
    idx += 1;
  }

  return {
    token: {
      kind: "string",
      value,
      raw: source.slice(start, idx),
      line: startLine,
    },
    nextIndex: idx,
    line,
  };
}

function readTemplateSegment(
  source: string,
  start: number,
  startLine: number,
): {
  readonly token: LexToken;
  readonly nextIndex: number;
  readonly line: number;
  readonly enteredExpression: boolean;
} {
  let idx = start;
  let value = "";
  let line = startLine;
  let enteredExpression = false;

  while (idx < source.length) {
    const ch = source.charAt(idx);
    if (ch === "\\") {
      const next = source.charAt(idx + 1);
      if (next === "\n") {
        line += 1;
      }
      value += next;
      idx += 2;
      continue;
    }
    if (ch === "`") {
      idx += 1;
      break;
    }
    if (ch === "$" && source.charAt(idx + 1) === "{") {
      idx += 2;
      enteredExpression = true;
      break;
    }
    if (ch === "\n") {
      line += 1;
    }
    value += ch;
    idx += 1;
  }

  return {
    token: {
      kind: "string",
      value,
      raw: source.slice(start, idx),
      line: startLine,
    },
    nextIndex: idx,
    line,
    enteredExpression,
  };
}

function tokenizeSource(source: string): readonly LexToken[] {
  const tokens: LexToken[] = [];
  const templateBraceStack: number[] = [];
  let idx = 0;
  let line = 1;

  while (idx < source.length) {
    const ch = source.charAt(idx);

    if (ch === "\n") {
      line += 1;
      idx += 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      idx += 1;
      continue;
    }

    if (ch === "/" && source.charAt(idx + 1) === "/") {
      const start = idx;
      const startLine = line;
      idx += 2;
      while (idx < source.length && source.charAt(idx) !== "\n") {
        idx += 1;
      }
      const raw = source.slice(start, idx);
      tokens.push({ kind: "comment", value: raw, raw, line: startLine });
      continue;
    }

    if (ch === "/" && source.charAt(idx + 1) === "*") {
      const start = idx;
      const startLine = line;
      idx += 2;
      while (
        idx < source.length &&
        !(source.charAt(idx) === "*" && source.charAt(idx + 1) === "/")
      ) {
        if (source.charAt(idx) === "\n") {
          line += 1;
        }
        idx += 1;
      }
      idx = Math.min(source.length, idx + 2);
      const raw = source.slice(start, idx);
      tokens.push({ kind: "comment", value: raw, raw, line: startLine });
      continue;
    }

    if (ch === "'" || ch === '"') {
      const strResult = readStringLiteral(source, idx, ch, line);
      tokens.push(strResult.token);
      idx = strResult.nextIndex;
      line = strResult.line;
      continue;
    }

    if (ch === "`") {
      const tplResult = readTemplateSegment(source, idx + 1, line);
      tokens.push(tplResult.token);
      idx = tplResult.nextIndex;
      line = tplResult.line;
      if (tplResult.enteredExpression) {
        templateBraceStack.push(0);
      }
      continue;
    }

    if (ch === "{" && templateBraceStack.length > 0) {
      const top = templateBraceStack.length - 1;
      templateBraceStack[top] = (templateBraceStack[top] ?? 0) + 1;
      tokens.push({ kind: "punct", value: "{", raw: "{", line });
      idx += 1;
      continue;
    }

    if (ch === "}" && templateBraceStack.length > 0) {
      const top = templateBraceStack.length - 1;
      const depth = templateBraceStack[top] ?? 0;
      if (depth === 0) {
        templateBraceStack.pop();
        tokens.push({ kind: "punct", value: "}", raw: "}", line });
        const tplResult = readTemplateSegment(source, idx + 1, line);
        tokens.push(tplResult.token);
        idx = tplResult.nextIndex;
        line = tplResult.line;
        if (tplResult.enteredExpression) {
          templateBraceStack.push(0);
        }
        continue;
      }
      templateBraceStack[top] = depth - 1;
      tokens.push({ kind: "punct", value: "}", raw: "}", line });
      idx += 1;
      continue;
    }

    if (ch === "/" && canPrecedeRegex(lastSignificantToken(tokens))) {
      const start = idx;
      const startLine = line;
      idx += 1;
      let inClass = false;
      while (idx < source.length) {
        const cur = source.charAt(idx);
        if (cur === "\\") {
          idx += 2;
          continue;
        }
        if (cur === "[") {
          inClass = true;
          idx += 1;
          continue;
        }
        if (cur === "]" && inClass) {
          inClass = false;
          idx += 1;
          continue;
        }
        if (cur === "/" && !inClass) {
          idx += 1;
          while (idx < source.length && /[a-z]/i.test(source.charAt(idx))) {
            idx += 1;
          }
          break;
        }
        if (cur === "\n") {
          break;
        }
        idx += 1;
      }
      const raw = source.slice(start, idx);
      tokens.push({ kind: "regex", value: raw, raw, line: startLine });
      continue;
    }

    if (isWordStart(ch)) {
      const start = idx;
      idx += 1;
      while (idx < source.length && isWordContinue(source.charAt(idx))) {
        idx += 1;
      }
      const word = source.slice(start, idx);
      tokens.push({ kind: "word", value: word, raw: word, line });
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const start = idx;
      idx += 1;
      while (
        idx < source.length &&
        /[0-9_a-fA-FxXbBoOn.]/.test(source.charAt(idx))
      ) {
        idx += 1;
      }
      const num = source.slice(start, idx);
      tokens.push({ kind: "number", value: num, raw: num, line });
      continue;
    }

    const tri = source.slice(idx, idx + 3);
    if (tri === "===" || tri === "!==" || tri === "...") {
      tokens.push({ kind: "punct", value: tri, raw: tri, line });
      idx += 3;
      continue;
    }

    const duo = source.slice(idx, idx + 2);
    if (
      duo === "==" ||
      duo === "!=" ||
      duo === "<=" ||
      duo === ">=" ||
      duo === "=>" ||
      duo === "&&" ||
      duo === "||" ||
      duo === "??" ||
      duo === "?."
    ) {
      tokens.push({ kind: "punct", value: duo, raw: duo, line });
      idx += 2;
      continue;
    }

    tokens.push({ kind: "punct", value: ch, raw: ch, line });
    idx += 1;
  }

  return tokens;
}

function getLineSnippet(lines: readonly string[], lineNumber: number): string {
  return (lines[lineNumber - 1] ?? "").trim();
}

const ASSERTION_CONTINUATION_KEYWORDS = new Set([
  "as",
  "satisfies",
  "in",
  "of",
  "instanceof",
  "extends",
]);

function isNonNullAssertionToken(
  codeTokens: readonly LexToken[],
  index: number,
): boolean {
  const prev = codeTokens[index - 1];
  const next = codeTokens[index + 1];
  if (!prev) {
    return false;
  }
  // JSX text ends cleanly at '<' or continues into plain Spanish prose words
  if (next?.value === "<") {
    return false;
  }
  if (
    next?.kind === "word" &&
    !ASSERTION_CONTINUATION_KEYWORDS.has(next.value)
  ) {
    return false;
  }
  if (prev.kind === "punct" && (prev.value === "]" || prev.value === ")")) {
    return true;
  }
  if (prev.kind === "word" && !UNARY_NEGATION_KEYWORDS.has(prev.value)) {
    return true;
  }
  return false;
}

function checkRelativeImportSpecifier(
  filePath: string,
  token: LexToken,
  lines: readonly string[],
  violations: StaticViolation[],
): void {
  if (token.value.startsWith("./") || token.value.startsWith("../")) {
    violations.push({
      rule: "no-relative-import",
      file: filePath,
      line: token.line,
      message: `Relative import "${token.value}" is forbidden; use "@/..." alias.`,
      snippet: getLineSnippet(lines, token.line),
    });
  }
}

export function analyzeStaticRules(
  filePath: string,
  content: string,
): readonly StaticViolation[] {
  const violations: StaticViolation[] = [];
  const lines = content.split(/\r?\n/);
  const tokens = tokenizeSource(content);
  const codeTokens: LexToken[] = [];
  const isTsx = filePath.endsWith(".tsx");

  for (const token of tokens) {
    if (token.kind === "comment") {
      if (/@ts-ignore\b|@ts-expect-error\b|@ts-nocheck\b/.test(token.value)) {
        violations.push({
          rule: "no-ts-suppression",
          file: filePath,
          line: token.line,
          message:
            "TypeScript suppression comments (@ts-ignore / @ts-expect-error / @ts-nocheck) are forbidden.",
          snippet: getLineSnippet(lines, token.line),
        });
      }
      continue;
    }

    if (token.kind === "string" && isTsx) {
      if (FORBIDDEN_IONIC_ARBITRARY_CSS_RE.test(token.value)) {
        violations.push({
          rule: "no-ionic-arbitrary-css-var",
          file: filePath,
          line: token.line,
          message:
            "Arbitrary Tailwind CSS custom properties like [--background:...] are forbidden in .tsx; bridge via src/index.css.",
          snippet: getLineSnippet(lines, token.line),
        });
      }
    }

    codeTokens.push(token);
  }

  for (let i = 0; i < codeTokens.length; i += 1) {
    const token = codeTokens[i];
    if (!token) {
      continue;
    }
    const prev = codeTokens[i - 1];
    const next = codeTokens[i + 1];
    const next2 = codeTokens[i + 2];

    if (
      token.kind === "word" &&
      token.value === "import" &&
      next?.kind === "punct" &&
      next.value === "(" &&
      prev?.value !== "."
    ) {
      if (next2?.kind === "string") {
        checkRelativeImportSpecifier(filePath, next2, lines, violations);
        const closeParen = codeTokens[i + 3];
        const afterClose = codeTokens[i + 4];
        const isInlineImportType =
          closeParen?.value === ")" && afterClose?.value === ".";
        violations.push({
          rule: isInlineImportType
            ? "no-inline-import-type"
            : "no-dynamic-import",
          file: filePath,
          line: token.line,
          message: isInlineImportType
            ? "Inline TypeScript import(...).Type syntax is forbidden; use static import type."
            : "Dynamic import(...) calls are forbidden; use static ES imports.",
          snippet: getLineSnippet(lines, token.line),
        });
      } else {
        violations.push({
          rule: "no-dynamic-import",
          file: filePath,
          line: token.line,
          message:
            "Dynamic import(...) calls are forbidden; use static ES imports.",
          snippet: getLineSnippet(lines, token.line),
        });
      }
    }

    if (
      token.kind === "word" &&
      token.value === "require" &&
      next?.kind === "punct" &&
      next.value === "(" &&
      prev?.value !== "."
    ) {
      violations.push({
        rule: "no-require",
        file: filePath,
        line: token.line,
        message: "CommonJS require(...) calls are forbidden.",
        snippet: getLineSnippet(lines, token.line),
      });
    }

    if (
      token.kind === "word" &&
      token.value === "declare" &&
      next?.kind === "word" &&
      next.value === "function"
    ) {
      violations.push({
        rule: "no-declare-function",
        file: filePath,
        line: token.line,
        message: "Ambient `declare function` bridge helpers are forbidden.",
        snippet: getLineSnippet(lines, token.line),
      });
    }

    if (
      token.kind === "word" &&
      token.value === "any" &&
      prev?.value !== "." &&
      ((prev?.kind === "punct" && ANY_PRECEDING_PUNCTS.has(prev.value)) ||
        (prev?.kind === "word" &&
          (prev.value === "as" ||
            prev.value === "extends" ||
            prev.value === "is")) ||
        (next?.kind === "punct" &&
          next.value === "[" &&
          next2?.kind === "punct" &&
          next2.value === "]"))
    ) {
      violations.push({
        rule: "no-explicit-any",
        file: filePath,
        line: token.line,
        message: "Explicit `any` type is forbidden.",
        snippet: getLineSnippet(lines, token.line),
      });
    }

    if (token.kind === "word" && token.value === "as") {
      const isDoubleCast =
        next?.kind === "word" &&
        next.value === "unknown" &&
        next2?.kind === "word" &&
        next2.value === "as";
      const isRecordCast =
        next?.kind === "word" &&
        next.value === "Record" &&
        next2?.kind === "punct" &&
        next2.value === "<";
      const isAnyCast = next?.kind === "word" && next.value === "any";
      if (isDoubleCast || isRecordCast || isAnyCast) {
        violations.push({
          rule: "no-unsafe-as-cast",
          file: filePath,
          line: token.line,
          message:
            "Unsafe `as unknown as`, `as Record<...>`, or `as any` casts are forbidden.",
          snippet: getLineSnippet(lines, token.line),
        });
      }
    }

    if (
      token.kind === "punct" &&
      token.value === "!" &&
      isNonNullAssertionToken(codeTokens, i)
    ) {
      violations.push({
        rule: "no-non-null-assertion",
        file: filePath,
        line: token.line,
        message: "Postfix non-null assertion (`!`) is forbidden.",
        snippet: getLineSnippet(lines, token.line),
      });
    }

    if (
      token.kind === "word" &&
      (token.value === "import" || token.value === "export")
    ) {
      if (next?.kind === "string") {
        checkRelativeImportSpecifier(filePath, next, lines, violations);
      } else {
        for (let j = i + 1; j < codeTokens.length; j += 1) {
          const scan = codeTokens[j];
          if (!scan || scan.value === ";") {
            break;
          }
          if (scan.kind === "word" && scan.value === "import") {
            break;
          }
          if (scan.kind === "word" && scan.value === "from") {
            const spec = codeTokens[j + 1];
            if (spec?.kind === "string") {
              checkRelativeImportSpecifier(filePath, spec, lines, violations);
            }
            break;
          }
        }
      }
    }
  }

  return violations;
}
