# Database Setup & Migrations — Maestro de Personal

This directory contains the database schema migrations, RPC operations (`guardar_*`), seed data, and verification suites for the Maestro de Personal application.

## Directory Structure

```text
db/
├── migrations/
│   ├── 001_schema.sql     # Normative DDL (Appendix A verbatim): estreg, pais, dependencia, cargo, personal, audit triggers, RLS
│   └── 002_guardar.sql    # SECURITY DEFINER functions for atomic lifecycle transitions and validations
├── seeds/
│   └── 001_seed.sql       # Normative seed data (Appendix B) with idempotent ON CONFLICT DO NOTHING
└── README.md              # Apply order, connection instructions, and verification queries
```

---

## 1. Environment Configuration

Connection parameters are read from `.env` in the repository root. Never commit `.env` or hardcode credentials.

### Pooler Environment (IPv4 / Supavisor — Recommended):
For environments without public IPv6 routing (Supabase direct host `db.<project-ref>.supabase.co` is IPv6-only), connect via Supavisor pooler:

```bash
POOLER_HOST="aws-1-us-east-1.pooler.supabase.com"
POOLER_PORT="6543"
POOLER_USER="postgres.<project-ref>"
DATABASE="postgres"
DB_PASSWORD="<project-database-password>"
```

### Direct Postgres Environment (when IPv6 routing is present):
```bash
HOST="db.<project-ref>.supabase.co"
PORT="5432"
USER="postgres"
DATABASE="postgres"
DB_PASSWORD="<project-database-password>"
```

---

## 2. Migration Apply Order

To bootstrap a database (fresh project or live environment), apply the SQL scripts in strict numeric order using environment variables:

### Single Command via Pooler (with Nix):
```bash
nix shell nixpkgs#postgresql --command sh -c '
set -a
. ./.env
set +a
PGPASSWORD="$DB_PASSWORD" psql -h "$POOLER_HOST" -p "$POOLER_PORT" -U "$POOLER_USER" -d postgres -v ON_ERROR_STOP=1 \
  -f db/migrations/001_schema.sql \
  -f db/migrations/002_guardar.sql \
  -f db/seeds/001_seed.sql
'
```

### Direct Connection Form:
```bash
set -a
. ./.env
set +a
psql "host=$HOST port=$PORT dbname=$DATABASE user=$USER password=$DB_PASSWORD sslmode=require" \
  -f db/migrations/001_schema.sql \
  -f db/migrations/002_guardar.sql \
  -f db/seeds/001_seed.sql
```

---

## 3. Fresh Project Bootstrap Order

When bootstrapping on a vanilla Postgres instance (outside managed Supabase):
1. Create Supabase client roles (if not already existing):
   ```sql
   CREATE ROLE anon;
   CREATE ROLE authenticated;
   ```
2. Apply `db/migrations/001_schema.sql`.
3. Apply `db/migrations/002_guardar.sql`.
4. Apply `db/seeds/001_seed.sql`.

---

## 4. Canonical Verification Queries

Execute these queries to verify database integrity:

### Query 1: Table Row Counts
Verify baseline seeds are loaded:
```sql
SELECT
  (SELECT count(*) FROM estreg) as estreg_count,
  (SELECT count(*) FROM pais) as pais_count,
  (SELECT count(*) FROM dependencia) as dep_count,
  (SELECT count(*) FROM cargo) as car_count,
  (SELECT count(*) FROM personal) as per_count;
```
**Expected Output:**
```text
 estreg_count | pais_count | dep_count | car_count | per_count 
--------------+------------+-----------+-----------+-----------
            3 |          5 |         3 |         5 |         4
```

### Query 2: Canonical List Queries (Informative / UI Grid)
Verify primary tables return correct seed records:
```sql
SELECT "PaiCod", "PaiNom", "PaiEstReg" FROM pais ORDER BY "PaiNom" ASC, "PaiCod" ASC;
SELECT "DepCod", "DepNom", "DepEstReg" FROM dependencia ORDER BY "DepNom" ASC, "DepCod" ASC;
SELECT "CarCod", "CarNom", "CarEstReg" FROM cargo ORDER BY "CarNom" ASC, "CarCod" ASC;
SELECT "PerCod", "PerNom", "PerDNI", "PerFecNac", "PerEstReg" FROM personal ORDER BY "PerCod" ASC;
```

### Query 3: Selection Queries (G-SEL / Active Dropdowns)
Verify that only rows with `EstReg = 1` (Activo) are returned for selection flows:
```sql
SELECT "PaiCod", "PaiNom" FROM pais WHERE "PaiEstReg" = 1 ORDER BY "PaiNom" ASC, "PaiCod" ASC;
SELECT "DepCod", "DepNom" FROM dependencia WHERE "DepEstReg" = 1 ORDER BY "DepNom" ASC, "DepCod" ASC;
SELECT "CarCod", "CarNom" FROM cargo WHERE "CarEstReg" = 1 ORDER BY "CarNom" ASC, "CarCod" ASC;
```

### Query 4: Audit Trigger Verification
Verify that `created_at` is immutable and `updated_at` increments on row modification:
```sql
DO $$
DECLARE
  v_c1 timestamptz;
  v_u1 timestamptz;
  v_c2 timestamptz;
  v_u2 timestamptz;
BEGIN
  SELECT created_at, updated_at INTO v_c1, v_u1 FROM pais WHERE "PaiCod" = 1;
  PERFORM pg_sleep(0.05);
  UPDATE pais SET "PaiNom" = 'Perú Modificado' WHERE "PaiCod" = 1;
  SELECT created_at, updated_at INTO v_c2, v_u2 FROM pais WHERE "PaiCod" = 1;

  IF v_c1 <> v_c2 THEN
    RAISE EXCEPTION 'Audit check failed: created_at changed!';
  END IF;
  IF v_u2 <= v_u1 THEN
    RAISE EXCEPTION 'Audit check failed: updated_at not bumped!';
  END IF;

  -- Restore value
  UPDATE pais SET "PaiNom" = 'Perú' WHERE "PaiCod" = 1;
  RAISE NOTICE 'AUDIT TRIGGER PASSED: created_at invariant, updated_at bumped.';
END $$;
```

### Query 5: Guardar Function Lifecycle & R11 Guard Verification
Verify that attempting to Eliminate (`set_state` to 3) a referenced reference-row raises `E-REF-BLOCKED`:
```sql
-- Attempt to eliminate Pais 1 (Perú), which is referenced by Personal rows 1, 2, 4
SELECT guardar_pais('set_state', 1::smallint, NULL, 3::smallint);
```
**Expected Output:**
```text
ERROR:  E-REF-BLOCKED: pais 1 is referenced by active/inactive personal
CONTEXT:  PL/pgSQL function guardar_pais(text,smallint,text,smallint) line 57 at RAISE
```
