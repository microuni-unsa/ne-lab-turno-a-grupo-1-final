# Supabase Setup, Migrations & Seeds — Maestro de Personal

Este directorio sigue el estándar oficial generado por `supabase init` para gestionar migraciones, configuración local, Edge Functions (reservado) y semillas del prototipo **Maestro de Personal**.

## Estructura

```text
supabase/
├── config.toml                                 # Configuración local/remota (Supabase CLI)
├── migrations/
│   ├── 20261115000001_schema.sql               # DDL normativo (SPEC Appendix A): tablas, triggers y RLS
│   └── 20261115000002_guardar.sql              # RPCs SECURITY DEFINER (guardar_*, set_state_*) y grants
├── functions/                                  # Reservado para Edge Functions (sin uso por diseño actual)
├── seed.sql                                    # Semillas normativas (SPEC Appendix B) idempotentes
└── README.md                                   # Instrucciones de aplicación y consultas de verificación
```

---

## 1. Uso con Supabase CLI

Si trabajas en desarrollo local con Docker:

```bash
supabase start
supabase db reset
```

Esto aplica en orden `supabase/migrations/*.sql` y luego `supabase/seed.sql` automáticamente (habilitado en `[db.migrations]` y `[db.seed]` dentro de `supabase/config.toml`).

Para enlazar y subir migraciones a un proyecto remoto en Supabase:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

*(Si necesitas cargar `supabase/seed.sql` en el proyecto remoto nuevo, ejecútalo una vez desde el SQL Editor de Supabase Studio o vía `psql`.)*

---

## 2. Uso directo por `psql` (Pooler IPv4 / Supavisor)

Para aplicar manualmente los SQL sin CLI local (por ejemplo mediante Nix o cliente Postgres directo):

```bash
set -a
. ./.env
set +a
PGPASSWORD="$DB_PASSWORD" psql -h "$POOLER_HOST" -p "$POOLER_PORT" -U "$POOLER_USER" -d postgres -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261115000001_schema.sql \
  -f supabase/migrations/20261115000002_guardar.sql \
  -f supabase/seed.sql
```

---

## 3. Consultas de Verificación

### Conteo de semillas iniciales (`Appendix B`)

```sql
SELECT
  (SELECT count(*) FROM estreg) AS estreg_count,
  (SELECT count(*) FROM pais) AS pais_count,
  (SELECT count(*) FROM dependencia) AS dep_count,
  (SELECT count(*) FROM cargo) AS car_count,
  (SELECT count(*) FROM personal) AS per_count;
```

Esperado: `estreg_count = 3`, `pais_count = 5`, `dep_count = 3`, `car_count = 5`, `per_count = 4`.

### Integridad `G-SEL` y `R11`

```sql
SELECT "PaiCod", "PaiNom" FROM pais WHERE "PaiEstReg" = 1 ORDER BY "PaiNom" ASC, "PaiCod" ASC;
SELECT "DepCod", "DepNom" FROM dependencia WHERE "DepEstReg" = 1 ORDER BY "DepNom" ASC, "DepCod" ASC;
SELECT "CarCod", "CarNom" FROM cargo WHERE "CarEstReg" = 1 ORDER BY "CarNom" ASC, "CarCod" ASC;

-- Debe lanzar E-REF-BLOCKED (Perú referenciado por personal activo):
SELECT guardar_pais('set_state', 1::smallint, NULL, 3::smallint);
```
