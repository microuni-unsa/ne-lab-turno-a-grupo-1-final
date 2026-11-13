/**
 * Maestro de Personal — Domain Core Barrel
 *
 * SPEC §3–§6, §8, §12. Normative public surface for core business domain logic.
 * Re-exports: constants, errors, types, validators, lifecycle, session.
 */

// Constants (§3)
export {
  DNI_LEN,
  EST_A,
  EST_I,
  EST_SIM_A,
  EST_SIM_I,
  EST_SIM_X,
  EST_X,
  MAX_INTEGER,
  MAX_NAME,
  MAX_SMALLINT,
  MIN_AGE,
  MIN_CODE,
  MIN_NAME,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_ESTREG,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core/constants";

// Errors & Failures (§12)
export {
  createFailure,
  E_DUP,
  E_FORMAT,
  E_PENDING,
  E_RANGE,
  E_REF,
  E_REF_BLOCKED,
  E_REF_STATE,
  E_REQUIRED,
  E_TRANSITION,
  ERROR_CODES,
  type ErrorCode,
  type FieldFailure,
  isFieldFailure,
} from "@/core/errors";
// Lifecycle State Machine (§6)
export {
  ADICION_FORCED_STATE,
  applyAdicionState,
  assertTransition,
  canTransition,
  forceAdicionState,
  getNextState,
  getStateFieldName,
  type LifecycleOp,
  normalizeLifecycleOp,
  TRANSITION_TABLE,
  type TransitionRule,
} from "@/core/lifecycle";
// Maintenance Session Machine (§8)
export {
  MaintenanceSession,
  type SessionCallbacks,
  type SessionOpResult,
} from "@/core/session";
// Types & Contracts (§4, §5, §8)
export {
  type AdicionOp,
  asCarCod,
  asDepCod,
  asPaiCod,
  asPerCod,
  type Brand,
  type CarCod,
  type CargoPayload,
  type CargoRow,
  type DepCod,
  type DependenciaPayload,
  type DependenciaRow,
  type EliminacionOp,
  type EstReg,
  type EstRegCod,
  type EstRegRow,
  type EstRegSim,
  type GuardarFailure,
  type GuardarResult,
  type GuardarSuccess,
  type InactivarOp,
  type MaintenanceTable,
  type ModificacionOp,
  type PaiCod,
  type PaisPayload,
  type PaisRow,
  type PendingOp,
  type PendingOpKind,
  type PerCod,
  type PersonalPayload,
  type PersonalRow,
  type ReactivarOp,
  type TableName,
  type TablePayload,
} from "@/core/types";
// Validators (§5, §12)
export {
  getCodeFieldName,
  getMaxCodeLimit,
  validateCargoRow,
  validateCode,
  validateDependenciaRow,
  validateDNI,
  validateFecNac,
  validateNom,
  validatePaisRow,
  validatePersonalRow,
  validateRow,
} from "@/core/validators";
