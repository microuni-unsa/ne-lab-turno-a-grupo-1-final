-- ============================================================
-- Maestro de Personal — Integer Identity Codes (revert VARCHAR codes)
-- Converts PaiCod, DepCod, CarCod, PerCod (and FKs) from VARCHAR(16)
-- to INTEGER GENERATED ALWAYS AS IDENTITY with DB-assigned values.
-- Precondition: all stored codes are numeric strings (live DB holds 1..N).
-- Non-numeric rows abort the migration via USING cast — audit first:
--   SELECT "PaiCod" FROM pais WHERE btrim("PaiCod") !~ '^[0-9]+$';
--   (repeat for DepCod, CarCod, PerCod, PerPaiCod, PerDepCod, PerCarCod)
-- ============================================================

-- ---- 1. Drop TEXT-code RPC overloads (recreated with INT below) ----
DROP FUNCTION IF EXISTS guardar_pais(TEXT, TEXT, TEXT, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS guardar_dependencia(TEXT, TEXT, TEXT, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS guardar_cargo(TEXT, TEXT, TEXT, SMALLINT, TEXT);
DROP FUNCTION IF EXISTS guardar_personal(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, SMALLINT, TEXT);

-- ---- 2. Drop FKs + VARCHAR nonempty checks ----
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'personal'::regclass
      AND contype = 'f'
      AND confrelid IN ('pais'::regclass, 'dependencia'::regclass, 'cargo'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE personal DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE pais DROP CONSTRAINT IF EXISTS pais_paicod_nonempty;
ALTER TABLE dependencia DROP CONSTRAINT IF EXISTS dependencia_depcod_nonempty;
ALTER TABLE cargo DROP CONSTRAINT IF EXISTS cargo_carcod_nonempty;
ALTER TABLE personal DROP CONSTRAINT IF EXISTS personal_percod_nonempty;

-- ---- 3. Convert PK columns to INTEGER IDENTITY ----
ALTER TABLE pais
  ALTER COLUMN "PaiCod" TYPE INTEGER USING btrim("PaiCod")::INTEGER;
ALTER TABLE pais
  ALTER COLUMN "PaiCod" ADD GENERATED ALWAYS AS IDENTITY,
  ADD CONSTRAINT pais_paicod_pos CHECK ("PaiCod" > 0);

ALTER TABLE dependencia
  ALTER COLUMN "DepCod" TYPE INTEGER USING btrim("DepCod")::INTEGER;
ALTER TABLE dependencia
  ALTER COLUMN "DepCod" ADD GENERATED ALWAYS AS IDENTITY,
  ADD CONSTRAINT dependencia_depcod_pos CHECK ("DepCod" > 0);

ALTER TABLE cargo
  ALTER COLUMN "CarCod" TYPE INTEGER USING btrim("CarCod")::INTEGER;
ALTER TABLE cargo
  ALTER COLUMN "CarCod" ADD GENERATED ALWAYS AS IDENTITY,
  ADD CONSTRAINT cargo_carcod_pos CHECK ("CarCod" > 0);

ALTER TABLE personal
  ALTER COLUMN "PerCod" TYPE INTEGER USING btrim("PerCod")::INTEGER,
  ALTER COLUMN "PerPaiCod" TYPE INTEGER USING btrim("PerPaiCod")::INTEGER,
  ALTER COLUMN "PerDepCod" TYPE INTEGER USING btrim("PerDepCod")::INTEGER,
  ALTER COLUMN "PerCarCod" TYPE INTEGER USING btrim("PerCarCod")::INTEGER;
ALTER TABLE personal
  ALTER COLUMN "PerCod" ADD GENERATED ALWAYS AS IDENTITY,
  ADD CONSTRAINT personal_percod_pos CHECK ("PerCod" > 0),
  ADD CONSTRAINT personal_perpai_fk FOREIGN KEY ("PerPaiCod") REFERENCES pais("PaiCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT personal_perdep_fk FOREIGN KEY ("PerDepCod") REFERENCES dependencia("DepCod") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT personal_percar_fk FOREIGN KEY ("PerCarCod") REFERENCES cargo("CarCod") ON UPDATE RESTRICT ON DELETE RESTRICT;

SELECT setval(pg_get_serial_sequence('pais', 'PaiCod'), COALESCE((SELECT MAX("PaiCod") FROM pais), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('dependencia', 'DepCod'), COALESCE((SELECT MAX("DepCod") FROM dependencia), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('cargo', 'CarCod'), COALESCE((SELECT MAX("CarCod") FROM cargo), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('personal', 'PerCod'), COALESCE((SELECT MAX("PerCod") FROM personal), 0) + 1, false);

-- ---- 5. Recreate guardar_* RPCs with INT codes; insert omits PK (identity) ----
CREATE OR REPLACE FUNCTION guardar_pais(
  op TEXT,
  p_cod INT DEFAULT NULL,
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
  v_cod INT := p_cod;
  v_row pais%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO pais ("PaiNom", "PaiEstReg")
    VALUES (p_nom, 1)
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
  p_cod INT DEFAULT NULL,
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
  v_cod INT := p_cod;
  v_row dependencia%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO dependencia ("DepNom", "DepEstReg")
    VALUES (p_nom, 1)
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
  p_cod INT DEFAULT NULL,
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
  v_cod INT := p_cod;
  v_row cargo%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO cargo ("CarNom", "CarEstReg")
    VALUES (p_nom, 1)
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
  p_cod INT DEFAULT NULL,
  p_nom TEXT DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_fecnac DATE DEFAULT NULL,
  p_pai INT DEFAULT NULL,
  p_dep INT DEFAULT NULL,
  p_car INT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL,
  p_supervisor_code TEXT DEFAULT NULL
) RETURNS personal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_cod INT := p_cod;
  v_pai INT := p_pai;
  v_dep INT := p_dep;
  v_car INT := p_car;
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
      "PerNom", "PerDNI", "PerFecNac",
      "PerPaiCod", "PerDepCod", "PerCarCod", "PerEstReg"
    ) VALUES (
      p_nom, p_dni, p_fecnac,
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

GRANT EXECUTE ON FUNCTION guardar_pais(TEXT, INT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_dependencia(TEXT, INT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_cargo(TEXT, INT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_personal(TEXT, INT, TEXT, TEXT, DATE, INT, INT, INT, SMALLINT, TEXT) TO anon, authenticated;
