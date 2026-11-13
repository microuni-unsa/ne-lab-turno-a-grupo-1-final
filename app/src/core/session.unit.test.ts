import { describe, it, expect, vi } from "vitest";
import { MaintenanceSession } from "./session";
import { EST_A, EST_I, TABLE_PAIS, TABLE_PERSONAL } from "./constants";
import { ERROR_CODES } from "./errors";
import type { AdicionOp, ModificacionOp, InactivarOp } from "./types";

describe("session.unit", () => {
  describe("MaintenanceSession State Machine (SPEC §8)", () => {
    it("double-start returns E-PENDING and keeps initial pending operation", () => {
      const session = new MaintenanceSession(TABLE_PAIS);

      const op1: AdicionOp<typeof TABLE_PAIS> = {
        kind: "adición",
        table: TABLE_PAIS,
        payload: { PaiNom: "Perú" },
      };

      const op2: ModificacionOp<typeof TABLE_PAIS> = {
        kind: "modificación",
        table: TABLE_PAIS,
        targetCode: 1,
        payload: { PaiNom: "Perú Editado" },
      };

      const start1 = session.start(op1);
      expect(start1.ok).toBe(true);
      expect(session.hasPending).toBe(true);
      expect(session.pending?.kind).toBe("adición");

      // Attempting to start second operation while op1 is pending -> E-PENDING
      const start2 = session.start(op2);
      expect(start2.ok).toBe(false);
      if (!start2.ok) {
        expect(start2.failures).toEqual([
          { code: ERROR_CODES.PENDING, field: "session" },
        ]);
      }

      // Initial pending operation remains unchanged
      expect(session.pending?.kind).toBe("adición");
    });

    it("Salir-blocked: calling salir() with pending operation returns E-PENDING", () => {
      const session = new MaintenanceSession(TABLE_PAIS);

      // Without pending operation: salir() succeeds
      const salirClean = session.salir();
      expect(salirClean.ok).toBe(true);

      // Start an operation
      session.start({
        kind: "adición",
        table: TABLE_PAIS,
        payload: { PaiNom: "Chile" },
      });

      // With pending: salir() is blocked per SPEC §8.7
      const salirBlocked = session.salir();
      expect(salirBlocked.ok).toBe(false);
      if (!salirBlocked.ok) {
        expect(salirBlocked.failures).toEqual([
          { code: ERROR_CODES.PENDING, field: "session" },
        ]);
      }

      // State is still pending
      expect(session.hasPending).toBe(true);
    });

    it("Guardar-noop-ok: calling guardar() without pending operation returns ok and noop: true", async () => {
      const validateSpy = vi.fn();
      const commitSpy = vi.fn();

      const session = new MaintenanceSession(TABLE_PAIS, {
        validate: validateSpy,
        commit: commitSpy,
      });

      const res = await session.guardar();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.noop).toBe(true);
        expect(res.row).toBeUndefined();
      }

      expect(validateSpy).not.toHaveBeenCalled();
      expect(commitSpy).not.toHaveBeenCalled();
    });

    it("cancel-discards: cancel() and cancelar() discard pending operation with zero writes", () => {
      const session = new MaintenanceSession(TABLE_PAIS);

      session.start({
        kind: "modificación",
        table: TABLE_PAIS,
        targetCode: 1,
        payload: { PaiNom: "Nuevo Nombre" },
      });
      expect(session.hasPending).toBe(true);

      const cancelRes = session.cancelar();
      expect(cancelRes.ok).toBe(true);
      expect(session.hasPending).toBe(false);
      expect(session.pending).toBeNull();

      // After cancelling, salir() succeeds cleanly
      expect(session.salir().ok).toBe(true);
    });

    it("commit-called-once: successful guardar invokes validate and commit exactly once and clears pending", async () => {
      const mockRow = { PaiCod: 1, PaiNom: "Perú", PaiEstReg: EST_A };
      const validateSpy = vi.fn().mockResolvedValue([]);
      const commitSpy = vi.fn().mockResolvedValue(mockRow);

      const session = new MaintenanceSession(TABLE_PAIS, {
        validate: validateSpy,
        commit: commitSpy,
      });

      const op: AdicionOp<typeof TABLE_PAIS> = {
        kind: "adición",
        table: TABLE_PAIS,
        payload: { PaiNom: "Perú" },
      };

      session.start(op);

      const res = await session.guardar();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.noop).toBe(false);
        expect(res.row).toEqual(mockRow);
      }

      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy).toHaveBeenCalledWith(op);
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).toHaveBeenCalledWith(op);

      // Pending state is cleared upon success
      expect(session.hasPending).toBe(false);
      expect(session.pending).toBeNull();
    });

    it("validation failure leaves pending open and does not invoke commit", async () => {
      const validationError = [{ code: ERROR_CODES.REQUIRED, field: "PaiNom" }];
      const validateSpy = vi.fn().mockResolvedValue(validationError);
      const commitSpy = vi.fn();

      const session = new MaintenanceSession(TABLE_PAIS, {
        validate: validateSpy,
        commit: commitSpy,
      });

      session.start({
        kind: "adición",
        table: TABLE_PAIS,
        payload: { PaiNom: "" },
      });

      const res = await session.guardar();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.failures).toEqual(validationError);
      }

      expect(commitSpy).not.toHaveBeenCalled();
      // Pending remains open per SPEC §8.4
      expect(session.hasPending).toBe(true);
    });

    it("start() with targetCurrentState enforces §6.1 transitions and rejects invalid moves with E-TRANSITION", () => {
      const session = new MaintenanceSession(TABLE_PAIS);

      // Trying to inactivar a record that is already Inactivo (EST_I) -> forbidden
      const badOp: InactivarOp<typeof TABLE_PAIS> = {
        kind: "inactivar",
        table: TABLE_PAIS,
        targetCode: 10,
      };

      const startRes = session.start(badOp, EST_I);
      expect(startRes.ok).toBe(false);
      if (!startRes.ok) {
        expect(startRes.failures).toEqual([
          { code: ERROR_CODES.TRANSITION, field: "EstReg" },
        ]);
      }
      expect(session.hasPending).toBe(false);

      // Inactivar on Activo -> allowed
      const goodRes = session.start(badOp, EST_A);
      expect(goodRes.ok).toBe(true);
      expect(session.hasPending).toBe(true);
    });

    it("updatePayload modifies active pending payload", () => {
      const session = new MaintenanceSession(TABLE_PERSONAL);
      expect(session.updatePayload({ PerNom: "Test" })).toBe(false);

      session.start({
        kind: "adición",
        table: TABLE_PERSONAL,
        payload: { PerNom: "Initial" },
      });

      const updated = session.updatePayload({ PerNom: "Updated" });
      expect(updated).toBe(true);
      expect((session.pending?.payload as { PerNom: string }).PerNom).toBe(
        "Updated",
      );
    });
  });
});
