import type { Page, Route } from "@playwright/test";

export interface MockPaisRow {
  PaiCod: number;
  PaiNom: string;
  PaiEstReg: number;
  created_at: string;
  updated_at: string;
}

export interface MockDependenciaRow {
  DepCod: number;
  DepNom: string;
  DepEstReg: number;
  created_at: string;
  updated_at: string;
}

export interface MockCargoRow {
  CarCod: number;
  CarNom: string;
  CarEstReg: number;
  created_at: string;
  updated_at: string;
}

export interface MockPersonalRow {
  PerCod: number;
  PerNom: string;
  PerDNI: string;
  PerFecNac: string;
  PerPaiCod: number;
  PerDepCod: number;
  PerCarCod: number;
  PerEstReg: number;
  created_at: string;
  updated_at: string;
}

export interface MockDatabaseSeed {
  pais?: MockPaisRow[];
  dependencia?: MockDependenciaRow[];
  cargo?: MockCargoRow[];
  personal?: MockPersonalRow[];
}

export interface MockDatabaseState {
  pais: MockPaisRow[];
  dependencia: MockDependenciaRow[];
  cargo: MockCargoRow[];
  personal: MockPersonalRow[];
  requests: Array<{ method: string; url: string; body?: unknown }>;
}

const TS = "2026-01-01T00:00:00.000Z";

export function createDefaultSeed(): Required<MockDatabaseSeed> {
  return {
    pais: [
      {
        PaiCod: 1,
        PaiNom: "Perú",
        PaiEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
      {
        PaiCod: 2,
        PaiNom: "Chile",
        PaiEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
      {
        PaiCod: 3,
        PaiNom: "Colombia",
        PaiEstReg: 2,
        created_at: TS,
        updated_at: TS,
      },
      {
        PaiCod: 4,
        PaiNom: "Ecuador",
        PaiEstReg: 3,
        created_at: TS,
        updated_at: TS,
      },
      {
        PaiCod: 5,
        PaiNom: "Bolivia",
        PaiEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
    ],
    dependencia: [
      {
        DepCod: 1,
        DepNom: "Sistemas",
        DepEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
      {
        DepCod: 2,
        DepNom: "Contabilidad",
        DepEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
      {
        DepCod: 3,
        DepNom: "Almacen",
        DepEstReg: 2,
        created_at: TS,
        updated_at: TS,
      },
      {
        DepCod: 4,
        DepNom: "Logística",
        DepEstReg: 3,
        created_at: TS,
        updated_at: TS,
      },
    ],
    cargo: [
      {
        CarCod: 1,
        CarNom: "Analista de Sistemas",
        CarEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
      {
        CarCod: 2,
        CarNom: "Contador General",
        CarEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
      {
        CarCod: 3,
        CarNom: "Asistente Contable",
        CarEstReg: 2,
        created_at: TS,
        updated_at: TS,
      },
      {
        CarCod: 4,
        CarNom: "Auxiliar Temporal",
        CarEstReg: 3,
        created_at: TS,
        updated_at: TS,
      },
    ],
    personal: [
      {
        PerCod: 1,
        PerNom: "Juan Pérez",
        PerDNI: "41234567",
        PerFecNac: "1995-03-14",
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 1,
        PerEstReg: 1,
        created_at: TS,
        updated_at: TS,
      },
      {
        PerCod: 2,
        PerNom: "María Gómez",
        PerDNI: "42345678",
        PerFecNac: "1992-07-22",
        PerPaiCod: 2,
        PerDepCod: 2,
        PerCarCod: 2,
        PerEstReg: 2,
        created_at: TS,
        updated_at: TS,
      },
      {
        PerCod: 3,
        PerNom: "Luis Torres",
        PerDNI: "43456789",
        PerFecNac: "1990-11-05",
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 2,
        PerEstReg: 3,
        created_at: TS,
        updated_at: TS,
      },
    ],
  };
}

function normalizeIlikePattern(pattern: string): RegExp {
  const unquoted =
    pattern.startsWith('"') && pattern.endsWith('"')
      ? pattern.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")
      : pattern;
  let regexStr = "";
  for (let i = 0; i < unquoted.length; i++) {
    const ch = unquoted[i] ?? "";
    if (ch === "\\" && i + 1 < unquoted.length) {
      const next = unquoted[i + 1] ?? "";
      regexStr += next.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      i++;
      continue;
    }
    if (ch === "%" || ch === "*") {
      regexStr += ".*";
      continue;
    }
    if (ch === "_") {
      regexStr += ".";
      continue;
    }
    regexStr += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${regexStr}$`, "i");
}

function readField(row: object, key: string): unknown {
  return Reflect.get(row, key);
}

function matchesCondition(row: object, col: string, expr: string): boolean {
  const value = readField(row, col);

  if (expr.startsWith("eq.")) {
    const target = expr.slice(3);
    if (typeof value === "number") {
      return value === Number(target);
    }
    return String(value ?? "") === target;
  }

  if (expr.startsWith("neq.")) {
    const target = expr.slice(4);
    if (typeof value === "number") {
      return value !== Number(target);
    }
    return String(value ?? "") !== target;
  }

  if (expr.startsWith("ilike.")) {
    const pattern = expr.slice(6);
    const re = normalizeIlikePattern(pattern);
    return re.test(String(value ?? ""));
  }

  if (expr.startsWith("gte.")) {
    const target = expr.slice(4);
    return String(value ?? "") >= target;
  }

  if (expr.startsWith("lte.")) {
    const target = expr.slice(4);
    return String(value ?? "") <= target;
  }

  if (expr.startsWith("in.(") && expr.endsWith(")")) {
    const items = expr
      .slice(4, -1)
      .split(",")
      .map((item) => item.trim());
    return items.includes(String(value ?? ""));
  }

  return true;
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? "";
    if (ch === "\\" && inQuotes && i + 1 < input.length) {
      current += ch + (input[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (ch === "," && !inQuotes) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts;
}

function matchesOrClause(row: object, orExpr: string): boolean {
  const inner =
    orExpr.startsWith("(") && orExpr.endsWith(")")
      ? orExpr.slice(1, -1)
      : orExpr;
  const parts = splitTopLevelCommas(inner);
  return parts.some((part) => {
    const dotIdx = part.indexOf(".");
    if (dotIdx <= 0) return false;
    const col = part.slice(0, dotIdx);
    const rest = part.slice(dotIdx + 1);
    return matchesCondition(row, col, rest);
  });
}

function applyOrdering<T extends object>(
  rows: readonly T[],
  orderParam: string | null,
): T[] {
  if (!orderParam) {
    return [...rows];
  }
  const clauses = orderParam.split(",").map((item) => {
    const [col, dir] = item.split(".");
    return { col: col ?? "", asc: dir !== "desc" };
  });

  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      const av = readField(a, clause.col);
      const bv = readField(b, clause.col);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), "es", {
          sensitivity: "case",
        });
      }
      if (cmp !== 0) {
        return clause.asc ? cmp : -cmp;
      }
    }
    return 0;
  });
}

function parseRangeHeader(
  headerVal: string | undefined,
  url: URL,
): { offset: number; limit: number } | null {
  const rangeParam = headerVal;
  if (rangeParam && /^\d+-\d+$/.test(rangeParam)) {
    const [fromStr, toStr] = rangeParam.split("-");
    const from = Number(fromStr);
    const to = Number(toStr);
    return { offset: from, limit: Math.max(0, to - from + 1) };
  }
  const offsetParam = url.searchParams.get("offset");
  const limitParam = url.searchParams.get("limit");
  if (offsetParam !== null && limitParam !== null) {
    return {
      offset: Number(offsetParam),
      limit: Number(limitParam),
    };
  }
  return null;
}

function filterTableRows<T extends object>(rows: readonly T[], url: URL): T[] {
  const filtered = rows.filter((row) => {
    for (const [key, val] of url.searchParams.entries()) {
      if (
        key === "select" ||
        key === "order" ||
        key === "offset" ||
        key === "limit"
      ) {
        continue;
      }
      if (key === "or") {
        if (!matchesOrClause(row, val)) {
          return false;
        }
        continue;
      }
      if (!matchesCondition(row, key, val)) {
        return false;
      }
    }
    return true;
  });

  return applyOrdering(filtered, url.searchParams.get("order"));
}

function projectColumns(
  rows: readonly object[],
  selectParam: string | null,
): object[] {
  if (!selectParam || selectParam.trim() === "*") {
    return [...rows];
  }
  const cols = selectParam
    .split(",")
    .map((col) => col.trim().replace(/^"+|"+$/g, ""))
    .filter((col) => col.length > 0 && col !== "*");
  if (cols.length === 0) {
    return [...rows];
  }
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const col of cols) {
      projected[col] = readField(row, col);
    }
    return projected;
  });
}

async function handleTableRoute(
  route: Route,
  state: MockDatabaseState,
  table: "pais" | "dependencia" | "cargo" | "personal",
) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();

  state.requests.push({ method, url: url.pathname + url.search });

  const tableRows: object[] = state[table];
  const matched = filterTableRows(tableRows, url);
  const total = matched.length;
  const headers = await request.allHeaders();
  const range = parseRangeHeader(headers.range, url);
  const paged = range
    ? matched.slice(range.offset, range.offset + range.limit)
    : matched;
  const projected = projectColumns(paged, url.searchParams.get("select"));

  const startOffset = range ? range.offset : 0;
  const contentRange =
    total === 0 || projected.length === 0
      ? `*/${total}`
      : `${startOffset}-${startOffset + projected.length - 1}/${total}`;

  const responseHeaders: Record<string, string> = {
    "content-type": "application/json",
    "content-range": contentRange,
    "access-control-expose-headers": "content-range",
  };

  if (method === "HEAD") {
    await route.fulfill({
      status: 200,
      headers: responseHeaders,
      body: "",
    });
    return;
  }

  await route.fulfill({
    status: 200,
    headers: responseHeaders,
    body: JSON.stringify(projected),
  });
}

function readBodyRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    out[key] = Object.getOwnPropertyDescriptor(raw, key)?.value;
  }
  return out;
}

function rpcError(
  route: Route,
  status: number,
  code: string,
  message: string,
  details: string | null = null,
) {
  return route.fulfill({
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, message, details, hint: null }),
  });
}

interface RefRpcConfig<T> {
  readonly rows: T[];
  readonly codeCol: string;
  readonly nomCol: string;
  readonly nomCiIndex: string;
  readonly personalFkKey: keyof MockPersonalRow & string;
  readonly getCod: (row: T) => number;
  readonly getNom: (row: T) => string;
  readonly getEst: (row: T) => number;
  readonly createRow: (cod: number, nom: string, nowIso: string) => T;
  readonly updateNom: (row: T, nom: string, nowIso: string) => T;
  readonly updateEst: (row: T, est: number, nowIso: string) => T;
}

function handleRefRpc<T>(
  route: Route,
  body: Record<string, unknown>,
  state: MockDatabaseState,
  config: RefRpcConfig<T>,
) {
  const op = String(body.op ?? "")
    .trim()
    .toLowerCase();
  const cod = typeof body.p_cod === "number" ? body.p_cod : null;
  const nom = typeof body.p_nom === "string" ? body.p_nom.trim() : null;
  const est = typeof body.p_est === "number" ? body.p_est : null;
  const nowIso = new Date().toISOString();

  if (op === "insert") {
    if (cod === null || nom === null || nom.length === 0) {
      return rpcError(
        route,
        400,
        "23502",
        `null value in column "${cod === null ? config.codeCol : config.nomCol}" violates not-null constraint`,
      );
    }
    if (!Number.isInteger(cod) || cod <= 0 || cod > 32767) {
      return rpcError(
        route,
        400,
        "23514",
        `violates check constraint "${config.codeCol}_check" (${config.codeCol} > 0)`,
      );
    }
    if (nom.length < 2 || nom.length > 100) {
      return rpcError(
        route,
        400,
        "23514",
        `violates check constraint "${config.nomCol}_check" (char_length(btrim("${config.nomCol}")) >= 2)`,
      );
    }
    if (config.rows.some((r) => config.getCod(r) === cod)) {
      return rpcError(
        route,
        409,
        "23505",
        `duplicate key value violates unique constraint "${config.codeCol}_pkey"`,
        `Key ("${config.codeCol}")=(${cod}) already exists.`,
      );
    }
    if (
      config.rows.some(
        (r) => config.getNom(r).toLowerCase() === nom.toLowerCase(),
      )
    ) {
      return rpcError(
        route,
        409,
        "23505",
        `duplicate key value violates unique constraint "${config.nomCiIndex}"`,
        `Key (lower(btrim("${config.nomCol}")))=(${nom.toLowerCase()}) already exists.`,
      );
    }
    const created = config.createRow(cod, nom, nowIso);
    config.rows.push(created);
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(created),
    });
  }

  const existingIdx = config.rows.findIndex((r) => config.getCod(r) === cod);
  if (existingIdx < 0) {
    return rpcError(route, 400, "P0001", "E-NOT-FOUND: record does not exist");
  }
  const existing = config.rows[existingIdx];
  if (!existing) {
    return rpcError(route, 400, "P0001", "E-NOT-FOUND: record does not exist");
  }
  const currentEst = config.getEst(existing);

  if (op === "update") {
    if (currentEst === 3) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: cannot modify eliminated row (*)",
      );
    }
    if (nom === null || nom.length === 0) {
      return rpcError(
        route,
        400,
        "23502",
        `null value in column "${config.nomCol}" violates not-null constraint`,
      );
    }
    if (nom.length < 2 || nom.length > 100) {
      return rpcError(
        route,
        400,
        "23514",
        `violates check constraint "${config.nomCol}_check" (char_length(btrim("${config.nomCol}")) >= 2)`,
      );
    }
    if (
      config.rows.some(
        (r) =>
          config.getCod(r) !== cod &&
          config.getNom(r).toLowerCase() === nom.toLowerCase(),
      )
    ) {
      return rpcError(
        route,
        409,
        "23505",
        `duplicate key value violates unique constraint "${config.nomCiIndex}"`,
        `Key (lower(btrim("${config.nomCol}")))=(${nom.toLowerCase()}) already exists.`,
      );
    }
    const updated = config.updateNom(existing, nom, nowIso);
    config.rows[existingIdx] = updated;
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  if (op === "set_state") {
    if (currentEst === 3) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: row is already Eliminado (*); state is terminal",
      );
    }
    if (currentEst === 1 && est === 1) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: row is already Activo (A)",
      );
    }
    if (currentEst === 2 && est === 2) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: row is already Inactivo (I)",
      );
    }
    if (est === 3 && cod !== null) {
      const hasLiveRef = state.personal.some(
        (p) =>
          p[config.personalFkKey] === cod &&
          (p.PerEstReg === 1 || p.PerEstReg === 2),
      );
      if (hasLiveRef) {
        return rpcError(
          route,
          400,
          "P0001",
          "E-REF-BLOCKED: referenced by active or inactive personal",
        );
      }
    }
    if (est !== 1 && est !== 2 && est !== 3) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: invalid target state",
      );
    }
    const updated = config.updateEst(existing, est, nowIso);
    config.rows[existingIdx] = updated;
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  return rpcError(route, 400, "P0001", `E-INVALID-OP: ${op}`);
}

function handlePersonalRpc(
  route: Route,
  body: Record<string, unknown>,
  state: MockDatabaseState,
) {
  const op = String(body.op ?? "")
    .trim()
    .toLowerCase();
  const cod = typeof body.p_cod === "number" ? body.p_cod : null;
  const nom = typeof body.p_nom === "string" ? body.p_nom.trim() : null;
  const dni = typeof body.p_dni === "string" ? body.p_dni.trim() : null;
  const fecnac =
    typeof body.p_fecnac === "string" ? body.p_fecnac.trim() : null;
  const pai = typeof body.p_pai === "number" ? body.p_pai : null;
  const dep = typeof body.p_dep === "number" ? body.p_dep : null;
  const car = typeof body.p_car === "number" ? body.p_car : null;
  const est = typeof body.p_est === "number" ? body.p_est : null;
  const nowIso = new Date().toISOString();

  const checkFk = (fkPai: number, fkDep: number, fkCar: number) => {
    const pRow = state.pais.find((r) => r.PaiCod === fkPai);
    if (!pRow) return "E-REF: PerPaiCod missing";
    if (pRow.PaiEstReg !== 1) return "E-REF-STATE: PerPaiCod inactive";
    const dRow = state.dependencia.find((r) => r.DepCod === fkDep);
    if (!dRow) return "E-REF: PerDepCod missing";
    if (dRow.DepEstReg !== 1) return "E-REF-STATE: PerDepCod inactive";
    const cRow = state.cargo.find((r) => r.CarCod === fkCar);
    if (!cRow) return "E-REF: PerCarCod missing";
    if (cRow.CarEstReg !== 1) return "E-REF-STATE: PerCarCod inactive";
    return null;
  };

  if (op === "insert") {
    if (
      cod === null ||
      !nom ||
      !dni ||
      !fecnac ||
      pai === null ||
      dep === null ||
      car === null
    ) {
      return rpcError(
        route,
        400,
        "23502",
        "null value in personal column violates not-null constraint",
      );
    }
    if (!Number.isInteger(cod) || cod <= 0 || cod > 2147483647) {
      return rpcError(
        route,
        400,
        "23514",
        'violates check constraint "personal_PerCod_check" ("PerCod" > 0)',
      );
    }
    if (nom.length < 2 || nom.length > 100) {
      return rpcError(
        route,
        400,
        "23514",
        'violates check constraint "personal_PerNom_check" (char_length(btrim("PerNom")) >= 2)',
      );
    }
    if (!/^\d{8}$/.test(dni)) {
      return rpcError(
        route,
        400,
        "23514",
        'violates check constraint "personal_PerDNI_check" ("PerDNI" ~ \'^[0-9]{8}$\')',
      );
    }
    if (state.personal.some((r) => r.PerCod === cod)) {
      return rpcError(
        route,
        409,
        "23505",
        'duplicate key value violates unique constraint "personal_pkey"',
        `Key ("PerCod")=(${cod}) already exists.`,
      );
    }
    if (state.personal.some((r) => r.PerDNI === dni)) {
      return rpcError(
        route,
        409,
        "23505",
        'duplicate key value violates unique constraint "personal_PerDNI_key"',
        `Key ("PerDNI")=(${dni}) already exists.`,
      );
    }
    const fkErr = checkFk(pai, dep, car);
    if (fkErr) {
      return rpcError(route, 400, "P0001", fkErr);
    }
    const created: MockPersonalRow = {
      PerCod: cod,
      PerNom: nom,
      PerDNI: dni,
      PerFecNac: fecnac,
      PerPaiCod: pai,
      PerDepCod: dep,
      PerCarCod: car,
      PerEstReg: 1,
      created_at: nowIso,
      updated_at: nowIso,
    };
    state.personal.push(created);
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(created),
    });
  }

  const idx = state.personal.findIndex((r) => r.PerCod === cod);
  if (idx < 0) {
    return rpcError(route, 400, "P0001", "E-NOT-FOUND: PerCod missing");
  }
  const existing = state.personal[idx];
  if (!existing) {
    return rpcError(route, 400, "P0001", "E-NOT-FOUND: PerCod missing");
  }

  if (op === "update") {
    if (existing.PerEstReg === 3) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: cannot modify eliminated row (*)",
      );
    }
    if (
      !nom ||
      !dni ||
      !fecnac ||
      pai === null ||
      dep === null ||
      car === null
    ) {
      return rpcError(
        route,
        400,
        "23502",
        "null value in personal column violates not-null constraint",
      );
    }
    if (nom.length < 2 || nom.length > 100) {
      return rpcError(
        route,
        400,
        "23514",
        'violates check constraint "personal_PerNom_check" (char_length(btrim("PerNom")) >= 2)',
      );
    }
    if (!/^\d{8}$/.test(dni)) {
      return rpcError(
        route,
        400,
        "23514",
        'violates check constraint "personal_PerDNI_check" ("PerDNI" ~ \'^[0-9]{8}$\')',
      );
    }
    if (state.personal.some((r) => r.PerCod !== cod && r.PerDNI === dni)) {
      return rpcError(
        route,
        409,
        "23505",
        'duplicate key value violates unique constraint "personal_PerDNI_key"',
        `Key ("PerDNI")=(${dni}) already exists.`,
      );
    }
    const fkErr = checkFk(pai, dep, car);
    if (fkErr) {
      return rpcError(route, 400, "P0001", fkErr);
    }
    const updated: MockPersonalRow = {
      ...existing,
      PerNom: nom,
      PerDNI: dni,
      PerFecNac: fecnac,
      PerPaiCod: pai,
      PerDepCod: dep,
      PerCarCod: car,
      updated_at: nowIso,
    };
    state.personal[idx] = updated;
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  if (op === "set_state") {
    if (existing.PerEstReg === 3) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: row is already Eliminado (*); state is terminal",
      );
    }
    if (existing.PerEstReg === 1 && est === 1) {
      return rpcError(route, 400, "P0001", "E-TRANSITION: already Activo");
    }
    if (existing.PerEstReg === 2 && est === 2) {
      return rpcError(route, 400, "P0001", "E-TRANSITION: already Inactivo");
    }
    if (est !== 1 && est !== 2 && est !== 3) {
      return rpcError(
        route,
        400,
        "P0001",
        "E-TRANSITION: invalid target state",
      );
    }
    const updated: MockPersonalRow = {
      ...existing,
      PerEstReg: est,
      updated_at: nowIso,
    };
    state.personal[idx] = updated;
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  return rpcError(route, 400, "P0001", `E-INVALID-OP: ${op}`);
}

/**
 * Intercepts all Supabase PostgREST table & RPC HTTP routes in Chromium
 * so Playwright E2E exercises the genuine SupabaseRepo + Supabase JS HTTP client.
 */
export async function setupSupabaseMock(
  page: Page,
  seedOverrides?: MockDatabaseSeed,
): Promise<MockDatabaseState> {
  const defaults = createDefaultSeed();
  const state: MockDatabaseState = {
    pais: seedOverrides?.pais ? [...seedOverrides.pais] : defaults.pais,
    dependencia: seedOverrides?.dependencia
      ? [...seedOverrides.dependencia]
      : defaults.dependencia,
    cargo: seedOverrides?.cargo ? [...seedOverrides.cargo] : defaults.cargo,
    personal: seedOverrides?.personal
      ? [...seedOverrides.personal]
      : defaults.personal,
    requests: [],
  };

  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;

    if (pathname.endsWith("/rest/v1/pais")) {
      await handleTableRoute(route, state, "pais");
      return;
    }
    if (pathname.endsWith("/rest/v1/dependencia")) {
      await handleTableRoute(route, state, "dependencia");
      return;
    }
    if (pathname.endsWith("/rest/v1/cargo")) {
      await handleTableRoute(route, state, "cargo");
      return;
    }
    if (pathname.endsWith("/rest/v1/personal")) {
      await handleTableRoute(route, state, "personal");
      return;
    }

    if (pathname.includes("/rest/v1/rpc/")) {
      const bodyRaw: unknown = req.postDataJSON();
      const body = readBodyRecord(bodyRaw);
      state.requests.push({ method: req.method(), url: pathname, body });

      if (pathname.endsWith("/guardar_pais")) {
        await handleRefRpc(route, body, state, {
          rows: state.pais,
          codeCol: "PaiCod",
          nomCol: "PaiNom",
          nomCiIndex: "pais_nom_ci",
          personalFkKey: "PerPaiCod",
          getCod: (r) => r.PaiCod,
          getNom: (r) => r.PaiNom,
          getEst: (r) => r.PaiEstReg,
          createRow: (cod, nom, nowIso) => ({
            PaiCod: cod,
            PaiNom: nom,
            PaiEstReg: 1,
            created_at: nowIso,
            updated_at: nowIso,
          }),
          updateNom: (r, nom, nowIso) => ({
            ...r,
            PaiNom: nom,
            updated_at: nowIso,
          }),
          updateEst: (r, est, nowIso) => ({
            ...r,
            PaiEstReg: est,
            updated_at: nowIso,
          }),
        });
        return;
      }
      if (pathname.endsWith("/guardar_dependencia")) {
        await handleRefRpc(route, body, state, {
          rows: state.dependencia,
          codeCol: "DepCod",
          nomCol: "DepNom",
          nomCiIndex: "dependencia_nom_ci",
          personalFkKey: "PerDepCod",
          getCod: (r) => r.DepCod,
          getNom: (r) => r.DepNom,
          getEst: (r) => r.DepEstReg,
          createRow: (cod, nom, nowIso) => ({
            DepCod: cod,
            DepNom: nom,
            DepEstReg: 1,
            created_at: nowIso,
            updated_at: nowIso,
          }),
          updateNom: (r, nom, nowIso) => ({
            ...r,
            DepNom: nom,
            updated_at: nowIso,
          }),
          updateEst: (r, est, nowIso) => ({
            ...r,
            DepEstReg: est,
            updated_at: nowIso,
          }),
        });
        return;
      }
      if (pathname.endsWith("/guardar_cargo")) {
        await handleRefRpc(route, body, state, {
          rows: state.cargo,
          codeCol: "CarCod",
          nomCol: "CarNom",
          nomCiIndex: "cargo_nom_ci",
          personalFkKey: "PerCarCod",
          getCod: (r) => r.CarCod,
          getNom: (r) => r.CarNom,
          getEst: (r) => r.CarEstReg,
          createRow: (cod, nom, nowIso) => ({
            CarCod: cod,
            CarNom: nom,
            CarEstReg: 1,
            created_at: nowIso,
            updated_at: nowIso,
          }),
          updateNom: (r, nom, nowIso) => ({
            ...r,
            CarNom: nom,
            updated_at: nowIso,
          }),
          updateEst: (r, est, nowIso) => ({
            ...r,
            CarEstReg: est,
            updated_at: nowIso,
          }),
        });
        return;
      }
      if (pathname.endsWith("/guardar_personal")) {
        await handlePersonalRpc(route, body, state);
        return;
      }
    }

    await route.abort();
  });

  return state;
}
