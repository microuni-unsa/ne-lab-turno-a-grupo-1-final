import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { analyzeStaticRules, type StaticViolation } from "@/test/static-rules";

const SCAN_ROOTS = ["src", "test", "e2e", "scripts"] as const;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectFiles(directory: string, output: string[]): void {
  if (!existsSync(directory)) {
    return;
  }
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, output);
      continue;
    }
    const ext = path.extname(entry.name);
    if (SOURCE_EXTENSIONS.has(ext)) {
      output.push(fullPath);
    }
  }
}

function main(): void {
  const cwd = process.cwd();
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    collectFiles(path.join(cwd, root), files);
  }
  files.sort();

  const allViolations: StaticViolation[] = [];
  for (const absolutePath of files) {
    const relativePath = path.relative(cwd, absolutePath);
    const content = readFileSync(absolutePath, "utf8");
    const violations = analyzeStaticRules(relativePath, content);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error(
      `Static rules check failed with ${allViolations.length} violation(s):`,
    );
    for (const v of allViolations) {
      console.error(`- [${v.rule}] ${v.file}:${v.line} — ${v.message}`);
      if (v.snippet) {
        console.error(`    ${v.snippet}`);
      }
    }
    process.exit(1);
  }

  console.log(`Static rules check passed (${files.length} files scanned).`);
}

main();
