import { PERMISSIONS, REQUIRED_PERMISSIONS } from "@eops/security";
import { describe, expect, it, vi } from "vitest";
import { ClosureReconciliationController } from "./closure-reconciliation.controller";
import type { ClosureReconciliationService } from "./closure-reconciliation.service";

function permission(name: keyof ClosureReconciliationController) {
  return Reflect.getMetadata(
    REQUIRED_PERMISSIONS,
    ClosureReconciliationController.prototype[name],
  );
}

const expectedUpdatedAt = "2026-11-18T12:00:00.000Z";

describe("ClosureReconciliationController — RBAC", () => {
  it("protege leitura no controller", () => {
    expect(
      Reflect.getMetadata(REQUIRED_PERMISSIONS, ClosureReconciliationController),
    ).toEqual([PERMISSIONS.closureReconciliation.read]);
  });

  it("exige permissão específica em cada mutação", () => {
    expect(permission("create")).toEqual([
      PERMISSIONS.closureReconciliation.create,
    ]);
    expect(permission("refresh")).toEqual([
      PERMISSIONS.closureReconciliation.refresh,
    ]);
    expect(permission("update")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("resolve")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("dismiss")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("reopenItem")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("registerException")).toEqual([
      PERMISSIONS.closureReconciliation.exceptions,
    ]);
    expect(permission("revokeException")).toEqual([
      PERMISSIONS.closureReconciliation.exceptions,
    ]);
    expect(permission("acceptException")).toEqual([
      PERMISSIONS.closureReconciliation.approve,
    ]);
    expect(permission("approve")).toEqual([
      PERMISSIONS.closureReconciliation.approve,
    ]);
    expect(permission("signoff")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("removeSignoff")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("submit")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("close")).toEqual([
      PERMISSIONS.closureReconciliation.close,
    ]);
    expect(permission("reopen")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
    expect(permission("cancel")).toEqual([
      PERMISSIONS.closureReconciliation.manage,
    ]);
  });
});

describe("ClosureReconciliationController — encaminhamento", () => {
  it("encaminha ator da detecção", async () => {
    const service = {
      refresh: vi.fn().mockResolvedValue({ id: "rec-1" }),
    } as unknown as ClosureReconciliationService;
    const controller = new ClosureReconciliationController(service);
    await controller.refresh(
      "rec-1",
      { expectedUpdatedAt },
      { user: { id: "actor-1" } } as never,
    );
    expect(service.refresh).toHaveBeenCalledWith(
      "rec-1",
      expectedUpdatedAt,
      "actor-1",
    );
  });

  it("encaminha aprovação de exceção com o revisor autenticado", async () => {
    const service = {
      acceptException: vi.fn().mockResolvedValue({ id: "rec-1" }),
    } as unknown as ClosureReconciliationService;
    const controller = new ClosureReconciliationController(service);
    await controller.acceptException(
      "rec-1",
      "exception-1",
      { expectedUpdatedAt, note: "Risco aceito" },
      { user: { id: "reviewer-1" } } as never,
    );
    expect(service.acceptException).toHaveBeenCalledWith(
      "rec-1",
      "exception-1",
      { expectedUpdatedAt, note: "Risco aceito" },
      "reviewer-1",
    );
  });

  it("encaminha encerramento com motivo e autor", async () => {
    const service = {
      close: vi.fn().mockResolvedValue({ id: "rec-1" }),
    } as unknown as ClosureReconciliationService;
    const controller = new ClosureReconciliationController(service);
    await controller.close(
      "rec-1",
      {
        expectedUpdatedAt,
        closureReason: "Encerramento operacional com pendências justificadas",
      },
      { user: { id: "closer-1" } } as never,
    );
    expect(service.close).toHaveBeenCalledWith(
      "rec-1",
      {
        expectedUpdatedAt,
        closureReason: "Encerramento operacional com pendências justificadas",
      },
      "closer-1",
    );
  });

  it("encaminha remoção de assinatura com concorrência", async () => {
    const service = {
      removeSignoff: vi.fn().mockResolvedValue({ id: "rec-1" }),
    } as unknown as ClosureReconciliationService;
    const controller = new ClosureReconciliationController(service);
    await controller.removeSignoff(
      "rec-1",
      "signoff-1",
      { expectedUpdatedAt },
      { user: { id: "actor-1" } } as never,
    );
    expect(service.removeSignoff).toHaveBeenCalledWith(
      "rec-1",
      "signoff-1",
      expectedUpdatedAt,
      "actor-1",
    );
  });
});
