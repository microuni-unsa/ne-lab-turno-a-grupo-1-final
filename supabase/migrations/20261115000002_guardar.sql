-- ============================================================
-- Maestro de Personal — RPC guardar functions
-- Atomic Guardar operations (insert, update, set_state)
-- SECURITY DEFINER functions granted to anon and authenticated.
-- ============================================================

-- ---- 1. Reference Table: PAIS ----
CREATE OR REPLACE FUNCTION guardar_pais(
  op TEXT,
  p_cod SMALLINT,
  p_nom TEXT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL
) RETURNS pais
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_row pais%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    -- R9: Adición always persists EstReg = 1 (Activo)
    INSERT INTO pais ("PaiCod", "PaiNom", "PaiEstReg")
    VALUES (p_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM pais WHERE "PaiCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PaiCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    -- §6.1: Modificar forbidden if Eliminado (*)
    IF v_row."PaiEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;

    -- Update non-code fields, preserve EstReg
    UPDATE pais
    SET "PaiNom" = p_nom
    WHERE "PaiCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM pais WHERE "PaiCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PaiCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."PaiEstReg";
    IF v_curr = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    -- R11: Eliminar blocked iff >= 1 Personal with EstReg in {1, 2} references it
    IF p_est = 3 THEN
      IF EXISTS (
        SELECT 1 FROM personal
        WHERE "PerPaiCod" = p_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: pais % is referenced by active/inactive personal', p_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE pais
    SET "PaiEstReg" = p_est
    WHERE "PaiCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 2. Reference Table: DEPENDENCIA ----
CREATE OR REPLACE FUNCTION guardar_dependencia(
  op TEXT,
  p_cod SMALLINT,
  p_nom TEXT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL
) RETURNS dependencia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_row dependencia%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    -- R9: Adición always persists EstReg = 1 (Activo)
    INSERT INTO dependencia ("DepCod", "DepNom", "DepEstReg")
    VALUES (p_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM dependencia WHERE "DepCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: DepCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    -- §6.1: Modificar forbidden if Eliminado (*)
    IF v_row."DepEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;

    -- Update non-code fields, preserve EstReg
    UPDATE dependencia
    SET "DepNom" = p_nom
    WHERE "DepCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM dependencia WHERE "DepCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: DepCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."DepEstReg";
    IF v_curr = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    -- R11: Eliminar blocked iff >= 1 Personal with EstReg in {1, 2} references it
    IF p_est = 3 THEN
      IF EXISTS (
        SELECT 1 FROM personal
        WHERE "PerDepCod" = p_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: dependencia % is referenced by active/inactive personal', p_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE dependencia
    SET "DepEstReg" = p_est
    WHERE "DepCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 3. Reference Table: CARGO ----
CREATE OR REPLACE FUNCTION guardar_cargo(
  op TEXT,
  p_cod SMALLINT,
  p_nom TEXT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL
) RETURNS cargo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_row cargo%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    -- R9: Adición always persists EstReg = 1 (Activo)
    INSERT INTO cargo ("CarCod", "CarNom", "CarEstReg")
    VALUES (p_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM cargo WHERE "CarCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: CarCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    -- §6.1: Modificar forbidden if Eliminado (*)
    IF v_row."CarEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;

    -- Update non-code fields, preserve EstReg
    UPDATE cargo
    SET "CarNom" = p_nom
    WHERE "CarCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM cargo WHERE "CarCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: CarCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."CarEstReg";
    IF v_curr = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: row is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    -- R11: Eliminar blocked iff >= 1 Personal with EstReg in {1, 2} references it
    IF p_est = 3 THEN
      IF EXISTS (
        SELECT 1 FROM personal
        WHERE "PerCarCod" = p_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: cargo % is referenced by active/inactive personal', p_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE cargo
    SET "CarEstReg" = p_est
    WHERE "CarCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 4. Master Table: PERSONAL ----
CREATE OR REPLACE FUNCTION guardar_personal(
  op TEXT,
  p_cod INT,
  p_nom TEXT DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_fecnac DATE DEFAULT NULL,
  p_pai SMALLINT DEFAULT NULL,
  p_dep SMALLINT DEFAULT NULL,
  p_car SMALLINT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL
) RETURNS personal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op TEXT := lower(btrim(op));
  v_row personal%ROWTYPE;
  v_curr SMALLINT;
  v_ref_est SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    -- Authoritative, race-free FK checks (E-REF / E-REF-STATE)
    -- 1. Pais
    SELECT "PaiEstReg" INTO v_ref_est FROM pais WHERE "PaiCod" = p_pai FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: PaiCod % not found in pais', p_pai USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: PaiCod % is not Activo', p_pai USING ERRCODE = 'P0001';
    END IF;

    -- 2. Dependencia
    SELECT "DepEstReg" INTO v_ref_est FROM dependencia WHERE "DepCod" = p_dep FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: DepCod % not found in dependencia', p_dep USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: DepCod % is not Activo', p_dep USING ERRCODE = 'P0001';
    END IF;

    -- 3. Cargo
    SELECT "CarEstReg" INTO v_ref_est FROM cargo WHERE "CarCod" = p_car FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: CarCod % not found in cargo', p_car USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: CarCod % is not Activo', p_car USING ERRCODE = 'P0001';
    END IF;

    -- R9: Adición always persists EstReg = 1 (Activo)
    INSERT INTO personal (
      "PerCod", "PerNom", "PerDNI", "PerFecNac",
      "PerPaiCod", "PerDepCod", "PerCarCod", "PerEstReg"
    ) VALUES (
      p_cod, p_nom, p_dni, p_fecnac,
      p_pai, p_dep, p_car, 1
    ) RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM personal WHERE "PerCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PerCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    -- §6.1: Modificar forbidden if Eliminado (*)
    IF v_row."PerEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated personal (*)' USING ERRCODE = 'P0001';
    END IF;

    -- FK checks (E-REF / E-REF-STATE)
    SELECT "PaiEstReg" INTO v_ref_est FROM pais WHERE "PaiCod" = p_pai FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: PaiCod % not found in pais', p_pai USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: PaiCod % is not Activo', p_pai USING ERRCODE = 'P0001';
    END IF;

    SELECT "DepEstReg" INTO v_ref_est FROM dependencia WHERE "DepCod" = p_dep FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: DepCod % not found in dependencia', p_dep USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: DepCod % is not Activo', p_dep USING ERRCODE = 'P0001';
    END IF;

    SELECT "CarEstReg" INTO v_ref_est FROM cargo WHERE "CarCod" = p_car FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-REF: CarCod % not found in cargo', p_car USING ERRCODE = 'P0001';
    ELSIF v_ref_est != 1 THEN
      RAISE EXCEPTION 'E-REF-STATE: CarCod % is not Activo', p_car USING ERRCODE = 'P0001';
    END IF;

    -- Update non-code columns, preserve EstReg
    UPDATE personal SET
      "PerNom" = p_nom,
      "PerDNI" = p_dni,
      "PerFecNac" = p_fecnac,
      "PerPaiCod" = p_pai,
      "PerDepCod" = p_dep,
      "PerCarCod" = p_car
    WHERE "PerCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'set_state' THEN
    SELECT * INTO v_row FROM personal WHERE "PerCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PerCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;

    IF p_est IS NULL OR p_est NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'E-TRANSITION: invalid target state %', p_est USING ERRCODE = 'P0001';
    END IF;

    v_curr := v_row."PerEstReg";
    IF v_curr = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: personal is already Eliminado (*); state is terminal' USING ERRCODE = 'P0001';
    ELSIF v_curr = 1 AND p_est = 1 THEN
      RAISE EXCEPTION 'E-TRANSITION: personal is already Activo (A)' USING ERRCODE = 'P0001';
    ELSIF v_curr = 2 AND p_est = 2 THEN
      RAISE EXCEPTION 'E-TRANSITION: personal is already Inactivo (I)' USING ERRCODE = 'P0001';
    END IF;

    -- R13: Personal has no referencing tables, so Eliminar is always allowed

    UPDATE personal
    SET "PerEstReg" = p_est
    WHERE "PerCod" = p_cod
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 5. State Transition Shortcuts (set_state_*) ----
CREATE OR REPLACE FUNCTION set_state_pais(p_cod SMALLINT, p_est SMALLINT)
RETURNS pais
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT guardar_pais('set_state', p_cod, NULL, p_est);
$$;

CREATE OR REPLACE FUNCTION set_state_dependencia(p_cod SMALLINT, p_est SMALLINT)
RETURNS dependencia
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT guardar_dependencia('set_state', p_cod, NULL, p_est);
$$;

CREATE OR REPLACE FUNCTION set_state_cargo(p_cod SMALLINT, p_est SMALLINT)
RETURNS cargo
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT guardar_cargo('set_state', p_cod, NULL, p_est);
$$;

CREATE OR REPLACE FUNCTION set_state_personal(p_cod INT, p_est SMALLINT)
RETURNS personal
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT guardar_personal('set_state', p_cod, NULL, NULL, NULL, NULL, NULL, NULL, p_est);
$$;

-- ---- 6. Security Grants (anon, authenticated) ----
GRANT EXECUTE ON FUNCTION guardar_pais(TEXT, SMALLINT, TEXT, SMALLINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_dependencia(TEXT, SMALLINT, TEXT, SMALLINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_cargo(TEXT, SMALLINT, TEXT, SMALLINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_personal(TEXT, INT, TEXT, TEXT, DATE, SMALLINT, SMALLINT, SMALLINT, SMALLINT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION set_state_pais(SMALLINT, SMALLINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_state_dependencia(SMALLINT, SMALLINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_state_cargo(SMALLINT, SMALLINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_state_personal(INT, SMALLINT) TO anon, authenticated;
