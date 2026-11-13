/**
 * Maestro de Personal — Domain Core Barrel
 *
 * SPEC §3–§6, §8, §12. Normative public surface for core business domain logic.
 * Re-exports: constants, errors, types, validators, lifecycle, session.
 */

// Constants (§3)
export {
  DNI_LEN,
  MIN_NAME,
  MAX_NAME,
  MIN_AGE,
  EST_A,
  EST_I,
  EST_X,
  EST_SIM_A,
  EST_SIM_I,
  EST_SIM_X,
  MIN_CODE,
  MAX_SMALLINT,
  MAX_INTEGER,
  TABLE_PAIS,
  TABLE_DEPENDENCIA,
  TABLE_CARGO,
  TABLE_PERSONAL,
  TABLE_ESTREG,
} from "./constants";

// Errors & Failures (§12)
export {
  ERROR_CODES,
  type ErrorCode,
  E_PENDING,
  E_REQUIRED,
  E_FORMAT,
  E_RANGE,
  E_DUP,
  E_REF,
  E_REF_STATE,
  E_REF_BLOCKED,
  E_TRANSITION,
  type FieldFailure,
  isFieldFailure,
  createFailure,
} from "./errors";

// Types & Contracts (§4, §5, §8)
export {
  type Brand,
  type PaiCod,
  type DepCod,
  type CarCod,
  type PerCod,
  asPaiCod,
  asDepCod,
  asCarCod,
  asPerCod,
  type EstReg,
  type EstRegCod,
  type EstRegSim,
  type MaintenanceTable,
  type TableName,
  type EstRegRow,
  type PaisRow,
  type DependenciaRow,
  type CargoRow,
  type PersonalRow,
  type PaisPayload,
  type DependenciaPayload,
  type CargoPayload,
  type PersonalPayload,
  type TablePayload,
  type PendingOpKind,
  type AdicionOp,
  type ModificacionOp,
  type EliminacionOp,
  type InactivarOp,
  type ReactivarOp,
  type PendingOp,
  type GuardarSuccess,
  type GuardarFailure,
  type GuardarResult,
} from "./types";

// Validators (§5, §12)
export {
  getCodeFieldName,
  getMaxCodeLimit,
  validateCode,
  validateNom,
  validateDNI,
  validateFecNac,
  validatePaisRow,
  validateDependenciaRow,
  validateCargoRow,
  validatePersonalRow,
  validateRow,
} from "./validators";

// Lifecycle State Machine (§6)
export {
  type TransitionRule,
  type LifecycleOp,
  TRANSITION_TABLE,
  normalizeLifecycleOp,
  canTransition,
  getNextState,
  assertTransition,
  ADICION_FORCED_STATE,
  forceAdicionState,
  getStateFieldName,
  applyAdicionState,
} from "./lifecycle";

// Maintenance Session Machine (§8)
export {
  type SessionCallbacks,
  type SessionOpResult,
  MaintenanceSession,
} from "./session";
