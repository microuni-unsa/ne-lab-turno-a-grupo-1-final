-- ============================================================
-- Maestro de Personal — One-Time Supervisor Authorization for Reactivar (*)
-- Allows reactivating Eliminado (*) -> Activo (A) ONLY when a valid
-- supervisor access code is supplied to guardar_*.
-- ============================================================

-- ---- 1. Supervisor Access Code Store (locked down with RLS) ----
CREATE TABLE IF NOT EXISTS supervisor_auth (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_code TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supervisor_auth ENABLE ROW LEVEL SECURITY;

-- Seed default supervisor code for lab evaluation if not already set
INSERT INTO supervisor_auth (id, access_code)
VALUES (1, 'SUP-2026')
ON CONFLICT (id) DO NOTHING;

-- ---- 2. Helper: Assert supervisor authorization for * -> A ----
CREATE OR REPLACE FUNCTION assert_supervisor_reactivar(p_supervisor_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected TEXT;
BEGIN
  IF p_supervisor_code IS NULL OR btrim(p_supervisor_code) = '' THEN
    RAISE EXCEPTION 'E-TRANSITION: row is already Eliminado (*); state is terminal without supervisor authorization'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT access_code INTO v_expected FROM supervisor_auth WHERE id = 1;
  IF NOT FOUND OR btrim(p_supervisor_code) <> v_expected THEN
    RAISE EXCEPTION 'E-AUTH-SUPERVISOR: invalid supervisor authorization code'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 3. Drop old signatures before recreating with p_supervisor_code ----
DROP FUNCTION IF EXISTS guardar_pais(TEXT, SMALLINT, TEXT, SMALLINT);
DROP FUNCTION IF EXISTS guardar_dependencia(TEXT, SMALLINT, TEXT, SMALLINT);
DROP FUNCTION IF EXISTS guardar_cargo(TEXT, SMALLINT, TEXT, SMALLINT);
DROP FUNCTION IF EXISTS guardar_personal(TEXT, INT, TEXT, TEXT, DATE, SMALLINT, SMALLINT, SMALLINT, SMALLINT);

-- ---- 4. PAIS ----
CREATE OR REPLACE FUNCTION guardar_pais(
  op TEXT,
  p_cod SMALLINT,
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
  v_row pais%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO pais ("PaiCod", "PaiNom", "PaiEstReg")
    VALUES (p_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM pais WHERE "PaiCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: PaiCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;
    IF v_row."PaiEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;
    UPDATE pais SET "PaiNom" = p_nom WHERE "PaiCod" = p_cod RETURNING * INTO v_row;
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
        WHERE "PerPaiCod" = p_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: pais % is referenced by active/inactive personal', p_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE pais SET "PaiEstReg" = p_est WHERE "PaiCod" = p_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 5. DEPENDENCIA ----
CREATE OR REPLACE FUNCTION guardar_dependencia(
  op TEXT,
  p_cod SMALLINT,
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
  v_row dependencia%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO dependencia ("DepCod", "DepNom", "DepEstReg")
    VALUES (p_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM dependencia WHERE "DepCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: DepCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;
    IF v_row."DepEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;
    UPDATE dependencia SET "DepNom" = p_nom WHERE "DepCod" = p_cod RETURNING * INTO v_row;
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
        WHERE "PerDepCod" = p_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: dependencia % is referenced by active/inactive personal', p_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE dependencia SET "DepEstReg" = p_est WHERE "DepCod" = p_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 6. CARGO ----
CREATE OR REPLACE FUNCTION guardar_cargo(
  op TEXT,
  p_cod SMALLINT,
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
  v_row cargo%ROWTYPE;
  v_curr SMALLINT;
BEGIN
  IF v_op = 'insert' THEN
    INSERT INTO cargo ("CarCod", "CarNom", "CarEstReg")
    VALUES (p_cod, p_nom, 1)
    RETURNING * INTO v_row;
    RETURN v_row;

  ELSIF v_op = 'update' THEN
    SELECT * INTO v_row FROM cargo WHERE "CarCod" = p_cod FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E-NOT-FOUND: CarCod % does not exist', p_cod USING ERRCODE = 'P0001';
    END IF;
    IF v_row."CarEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated row (*)' USING ERRCODE = 'P0001';
    END IF;
    UPDATE cargo SET "CarNom" = p_nom WHERE "CarCod" = p_cod RETURNING * INTO v_row;
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
        WHERE "PerCarCod" = p_cod AND "PerEstReg" IN (1, 2)
      ) THEN
        RAISE EXCEPTION 'E-REF-BLOCKED: cargo % is referenced by active/inactive personal', p_cod USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE cargo SET "CarEstReg" = p_est WHERE "CarCod" = p_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 7. PERSONAL ----
CREATE OR REPLACE FUNCTION guardar_personal(
  op TEXT,
  p_cod INT,
  p_nom TEXT DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_fecnac DATE DEFAULT NULL,
  p_pai SMALLINT DEFAULT NULL,
  p_dep SMALLINT DEFAULT NULL,
  p_car SMALLINT DEFAULT NULL,
  p_est SMALLINT DEFAULT NULL,
  p_supervisor_code TEXT DEFAULT NULL
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
    IF v_row."PerEstReg" = 3 THEN
      RAISE EXCEPTION 'E-TRANSITION: cannot modify eliminated personal (*)' USING ERRCODE = 'P0001';
    END IF;

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

    UPDATE personal SET "PerEstReg" = p_est WHERE "PerCod" = p_cod RETURNING * INTO v_row;
    RETURN v_row;

  ELSE
    RAISE EXCEPTION 'E-INVALID-OP: unknown operation %', op USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---- 8. Grants ----
GRANT EXECUTE ON FUNCTION guardar_pais(TEXT, SMALLINT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_dependencia(TEXT, SMALLINT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_cargo(TEXT, SMALLINT, TEXT, SMALLINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_personal(TEXT, INT, TEXT, TEXT, DATE, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT) TO anon, authenticated;
