-- ============================================================
-- Maestro de Personal — Hashed Supervisor Code + String Codes
-- 1. Hash supervisor_auth.access_code with pgcrypto bcrypt.
-- 2. Add verify_supervisor_code(TEXT) RPC for immediate validation.
-- 3. Convert PaiCod, DepCod, CarCod, PerCod (and FKs) to VARCHAR(16).
-- ============================================================

-- ---- 1. pgcrypto & Hashed Supervisor Code ----
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE supervisor_auth
SET access_code = extensions.crypt(access_code, extensions.gen_salt('bf')),
    updated_at = now()
WHERE access_code NOT LIKE '$2%';

CREATE OR REPLACE FUNCTION verify_supervisor_code(p_supervisor_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_expected TEXT;
BEGIN
  IF p_supervisor_code IS NULL OR btrim(p_supervisor_code) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT access_code INTO v_expected FROM supervisor_auth WHERE id = 1;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN extensions.crypt(btrim(p_supervisor_code), v_expected) = v_expected;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_supervisor_code(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION assert_supervisor_reactivar(p_supervisor_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_expected TEXT;
BEGIN
  IF p_supervisor_code IS NULL OR btrim(p_supervisor_code) = '' THEN
    RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal without supervisor authorization'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT access_code INTO v_expected FROM supervisor_auth WHERE id = 1;
  IF NOT FOUND OR extensions.crypt(btrim(p_supervisor_code), v_expected) <> v_expected THEN
    RAISE EXCEPTION 'E-AUTH-SUPERVISOR: invalid supervisor authorization code'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 2. Convert Code Columns to VARCHAR(16) ----
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop foreign keys on personal referencing pais/dependencia/cargo
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'personal'::regclass
      AND contype = 'f'
      AND confrelid IN ('pais'::regclass, 'dependencia'::regclass, 'cargo'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE personal DROP CONSTRAINT %I', r.conname);
  END LOOP;

  -- Drop numeric > 0 check constraints on code columns
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE conrelid IN ('pais'::regclass, 'dependencia'::regclass, 'cargo'::regclass, 'personal'::regclass)
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ 'Cod.*> 0'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE pais
  ALTER COLUMN "PaiCod" TYPE VARCHAR(16) USING btrim("PaiCod"::TEXT),
  ADD CONSTRAINT pais_paicod_nonempty CHECK (char_length(btrim("PaiCod")) >= 1);

ALTER TABLE dependencia
  ALTER COLUMN "DepCod" TYPE VARCHAR(16) USING btrim("DepCod"::TEXT),
  ADD CONSTRAINT dependencia_depcod_nonempty CHECK (char_length(btrim("DepCod")) >= 1);

ALTER TABLE cargo
  ALTER COLUMN "CarCod" TYPE VARCHAR(16) USING btrim("CarCod"::TEXT),
  ADD CONSTRAINT cargo_carcod_nonempty CHECK (char_length(btrim("CarCod")) >= 1);

ALTER TABLE personal
  ALTER COLUMN "PerCod" TYPE VARCHAR(16) USING btrim("PerCod"::TEXT),
  ALTER COLUMN "PerPaiCod" TYPE VARCHAR(16) USING btrim("PerPaiCod"::TEXT),
  ALTER COLUMN "PerDepCod" TYPE VARCHAR(16) USING btrim("PerDepCod"::TEXT),
  ALTER COLUMN "PerCarCod" TYPE VARCHAR(16) USING btrim("PerCarCod"::TEXT),
  ADD CONSTRAINT personal_percod_nonempty CHECK (char_length(btrim("PerCod")) >= 1),
  ADD CONSTRAINT personal_perpai_fk FOREIGN KEY ("PerPaiCod") REFERENCES pais("PaiCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT personal_perdep_fk FOREIGN KEY ("PerDepCod") REFERENCES dependencia("DepCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT personal_percar_fk FOREIGN KEY ("PerCarCod") REFERENCES cargo("CarCod") ON UPDATE RESTRICT ON DELETE RESTRICT;

-- ---- 3. Recreate guardar_* RPCs with TEXT codes ----
DROP FUNCTION IF EXISTS guardar_pais(TEXT, SMALLINT, TEXT, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS guardar_dependencia(TEXT, SMALLINT, TEXT, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS guardar_cargo(TEXT, SMALLINT, TEXT, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS guardar_personal(TEXT, INT, TEXT, TEXT, DATE, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT);

CREATE OR REPLACE FUNCTION guardar_pais(
  op TEXT,
  p_cod TEXT,
  p_nom TEXT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL,
  p_supervisor_code TEXT DEFAULT NULL
) RETURNS pais
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_cod TEXT := btrim(p_cod);
  v_row pais%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO pais ("PaiCod", "PaiNom", "PaiEstReg")
    VALUES (v_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM pais WHERE "PaiCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PaiCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF v_row."PaiEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;
    UPDATE pais SET "PaiNom" = p_nom WHERE "PaiCod" = v_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM pais WHERE "PaiCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PaiCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."PaiEstReg";
    IF v_curr = 3 THEN
      IF p_est = 1 THEN
        PERFORM assert_supervisor_reactivar(p_supervisor_code);
      ELSE
        RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
      END IF;
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    IF p_est = 3 THEN
      IF EXISTS (
        SELECT 1 FROM personal
        WHERE "PerPaiCod" = v_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: pais % is referenced by active/inactive personal', v_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE pais SET "PaiEstReg" = p_est WHERE "PaiCod" = v_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION guardar_dependencia(
  op TEXT,
  p_cod TEXT,
  p_nom TEXT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL,
  p_supervisor_code TEXT DEFAULT NULL
) RETURNS dependencia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_cod TEXT := btrim(p_cod);
  v_row dependencia%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO dependencia ("DepCod", "DepNom", "DepEstReg")
    VALUES (v_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM dependencia WHERE "DepCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: DepCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF v_row."DepEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;
    UPDATE dependencia SET "DepNom" = p_nom WHERE "DepCod" = v_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM dependencia WHERE "DepCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: DepCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."DepEstReg";
    IF v_curr = 3 THEN
      IF p_est = 1 THEN
        PERFORM assert_supervisor_reactivar(p_supervisor_code);
      ELSE
        RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
      END IF;
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    IF p_est = 3 THEN
      IF EXISTS (
        SELECT 1 FROM personal
        WHERE "PerDepCod" = v_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: dependencia % is referenced by active/inactive personal', v_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE dependencia SET "DepEstReg" = p_est WHERE "DepCod" = v_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION guardar_cargo(
  op TEXT,
  p_cod TEXT,
  p_nom TEXT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL,
  p_supervisor_code TEXT DEFAULT NULL
) RETURNS cargo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_cod TEXT := btrim(p_cod);
  v_row cargo%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO cargo ("CarCod", "CarNom", "CarEstReg")
    VALUES (v_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM cargo WHERE "CarCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: CarCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF v_row."CarEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;
    UPDATE cargo SET "CarNom" = p_nom WHERE "CarCod" = v_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM cargo WHERE "CarCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: CarCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."CarEstReg";
    IF v_curr = 3 THEN
      IF p_est = 1 THEN
        PERFORM assert_supervisor_reactivar(p_supervisor_code);
      ELSE
        RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
      END IF;
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    IF p_est = 3 THEN
      IF EXISTS (
        SELECT 1 FROM personal
        WHERE "PerCarCod" = v_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: cargo % is referenced by active/inactive personal', v_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE cargo SET "CarEstReg" = p_est WHERE "CarCod" = v_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION guardar_personal(
  op TEXT,
  p_cod TEXT,
  p_nom TEXT DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_fecnac DATE DEFAULT NULL,
  p_pai TEXT DEFAULT NULL,
  p_dep TEXT DEFAULT NULL,
  p_car TEXT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL,
  p_supervisor_code TEXT DEFAULT NULL
) RETURNS personal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_cod TEXT := btrim(p_cod);
  v_pai TEXT := btrim(p_pai);
  v_dep TEXT := btrim(p_dep);
  v_car TEXT := btrim(p_car);
  v_row personal%ROWTYPE;
  v_curr SMALLINT;
  v_ref_est SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    SELECT "PaiEstReg" INTO v_ref_est FROM pais WHERE "PaiCod" = v_pai FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: PaiCod % not found in pais', v_pai USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: PaiCod % is not Activo', v_pai USING ERRCODE = 'P0001';
    END IF;

    SELECT "DepEstReg" INTO v_ref_est FROM dependencia WHERE "DepCod" = v_dep FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: DepCod % not found in dependencia', v_dep USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: DepCod % is not Activo', v_dep USING ERRCODE = 'P0001';
    END IF;

    SELECT "CarEstReg" INTO v_ref_est FROM cargo WHERE "CarCod" = v_car FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: CarCod % not found in cargo', v_car USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: CarCod % is not Activo', v_car USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO personal (
      "PerCod", "PerNom", "PerDNI", "PerFecNac",
      "PerPaiCod", "PerDepCod", "PerCarCod", "PerEstReg"
    ) VALUES (
      v_cod, p_nom, p_dni, p_fecnac,
      v_pai, v_dep, v_car, 1
    ) RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM personal WHERE "PerCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PerCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF v_row."PerEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated personal (*)' USING ERRCODE = 'P0001';
    END IF;

    SELECT "PaiEstReg" INTO v_ref_est FROM pais WHERE "PaiCod" = v_pai FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: PaiCod % not found in pais', v_pai USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: PaiCod % is not Activo', v_pai USING ERRCODE = 'P0001';
    END IF;

    SELECT "DepEstReg" INTO v_ref_est FROM dependencia WHERE "DepCod" = v_dep FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: DepCod % not found in dependencia', v_dep USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: DepCod % is not Activo', v_dep USING ERRCODE = 'P0001';
    END IF;

    SELECT "CarEstReg" INTO v_ref_est FROM cargo WHERE "CarCod" = v_car FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: CarCod % not found in cargo', v_car USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: CarCod % is not Activo', v_car USING ERRCODE = 'P0001';
    END IF;

    UPDATE personal SET
      "PerNom" = p_nom,
      "PerDNI" = p_dni,
      "PerFecNac" = p_fecnac,
      "PerPaiCod" = v_pai,
      "PerDepCod" = v_dep,
      "PerCarCod" = v_car
    WHERE "PerCod" = v_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM personal WHERE "PerCod" = v_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PerCod % does not exist', v_cod USING ERRCODE = 'P0001';
    END IF;
    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."PerEstReg";
    IF v_curr = 3 THEN
      IF p_est = 1 THEN
        PERFORM assert_supervisor_reactivar(p_supervisor_code);
      ELSE
        RAISE EXCEPTION 'E-TRANSITION: personal is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
      END IF;
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: personal is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: personal is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    UPDATE personal SET "PerEstReg" = p_est WHERE "PerCod" = v_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION guardar_pais(TEXT, TEXT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_dependencia(TEXT, TEXT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_cargo(TEXT, TEXT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_personal(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
