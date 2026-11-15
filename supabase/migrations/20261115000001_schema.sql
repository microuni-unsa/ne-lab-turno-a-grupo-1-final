-- ============================================================
-- Maestro de Personal — normative schema. Apply once, in order.
-- ============================================================

-- ---- 0. State lookup (root; everything FKs here) ----
CREATE TABLE estreg (
  "EstRegCod" SMALLINT PRIMARY KEY,
  "EstRegNom" VARCHAR(10) NOT NULL UNIQUE,
  "EstRegSim" CHAR(1) NOT NULL UNIQUE
    CHECK ("EstRegSim" IN ('A','I','*'))
);

INSERT INTO estreg ("EstRegCod","EstRegNom","EstRegSim") VALUES
  (1,'Activo','A'),
  (2,'Inactivo','I'),
  (3,'Eliminado','*');

-- ---- 1. Reference tables (identical shape) ----
CREATE TABLE pais (
  "PaiCod"    SMALLINT NOT NULL PRIMARY KEY CHECK ("PaiCod" > 0),
  "PaiNom"    VARCHAR(100) NOT NULL CHECK (char_length(btrim("PaiNom")) >= 2),
  "PaiEstReg" SMALLINT NOT NULL DEFAULT 1
    REFERENCES estreg("EstRegCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pais_nom_ci ON pais (lower(btrim("PaiNom")));

CREATE TABLE dependencia (
  "DepCod"    SMALLINT NOT NULL PRIMARY KEY CHECK ("DepCod" > 0),
  "DepNom"    VARCHAR(100) NOT NULL CHECK (char_length(btrim("DepNom")) >= 2),
  "DepEstReg" SMALLINT NOT NULL DEFAULT 1
    REFERENCES estreg("EstRegCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dependencia_nom_ci ON dependencia (lower(btrim("DepNom")));

CREATE TABLE cargo (
  "CarCod"    SMALLINT NOT NULL PRIMARY KEY CHECK ("CarCod" > 0),
  "CarNom"    VARCHAR(100) NOT NULL CHECK (char_length(btrim("CarNom")) >= 2),
  "CarEstReg" SMALLINT NOT NULL DEFAULT 1
    REFERENCES estreg("EstRegCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cargo_nom_ci ON cargo (lower(btrim("CarNom")));

-- ---- 2. Master table ----
CREATE TABLE personal (
  "PerCod"    INTEGER NOT NULL PRIMARY KEY CHECK ("PerCod" > 0),
  "PerNom"    VARCHAR(100) NOT NULL CHECK (char_length(btrim("PerNom")) >= 2),
  "PerDNI"    CHAR(8) NOT NULL UNIQUE CHECK ("PerDNI" ~ '^[0-9]{8}$'),
  "PerFecNac" DATE NOT NULL
    CHECK ("PerFecNac" <= (current_date - INTERVAL '18 years')::date),
  "PerPaiCod" SMALLINT NOT NULL
    REFERENCES pais("PaiCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  "PerDepCod" SMALLINT NOT NULL
    REFERENCES dependencia("DepCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  "PerCarCod" SMALLINT NOT NULL
    REFERENCES cargo("CarCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  "PerEstReg" SMALLINT NOT NULL DEFAULT 1
    REFERENCES estreg("EstRegCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- 3. Audit triggers (DB-owned timestamps; created_at immutable) ----
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER pais_audit     BEFORE UPDATE ON pais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dependencia_audit BEFORE UPDATE ON dependencia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER cargo_audit    BEFORE UPDATE ON cargo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER personal_audit BEFORE UPDATE ON personal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ---- 4. Row-level security: prototype-open (no auth in scope) ----
-- NOTE: `anon` / `authenticated` are Supabase-managed roles — present in every
-- Supabase project; on vanilla Postgres create them first (verification only).
-- Permissive by design for the graded prototype. Production would scope these.
ALTER TABLE pais        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal    ENABLE ROW LEVEL SECURITY;

CREATE POLICY open_all ON pais        FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY open_all ON dependencia FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY open_all ON cargo       FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY open_all ON personal    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
-- estreg: readable catalog, no app writes; leave RLS off (or mirror open-read if enabled).
