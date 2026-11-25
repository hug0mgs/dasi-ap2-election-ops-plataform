import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@eops/security";
import { ReportsController } from "./reports.controller";
import type { ReportsService } from "./reports.service";
import type { ReportsViewsService } from "./reports-views.service";

function response() {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  } as unknown as Response;
}

function request(id = "user-1") {
  return { user: { id, permissions: ["reports.read", "reports.export"] } } as unknown as AuthenticatedRequest;
}

function setup(savedView?: Record<string, unknown>) {
  const service = {
    csv: vi.fn().mockResolvedValue("csv"),
    pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF content")),
  } as unknown as ReportsService;
  const views = {
    resolveForExport: vi.fn().mockResolvedValue(savedView),
  } as unknown as ReportsViewsService;
  return { controller: new ReportsController(service, views), service, views };
}

describe("ReportsController export por view", () => {
  it("mantem exportacao CSV ad hoc", async () => {
    const { controller, service, views } = setup();
    const res = response();
    await controller.csv({ electionId: "e-1" }, request(), res);
    expect(views.resolveForExport).not.toHaveBeenCalled();
    expect(service.csv).toHaveBeenCalledWith(expect.objectContaining({ electionId: "e-1" }), undefined);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=relatorio-election-ops.csv");
  });

  it("usa somente filtros persistidos e gera filename seguro", async () => {
    const saved = {
      id: "view-1",
      ownerId: "owner-1",
      name: "Críticos / Zona São Paulo",
      shared: true,
      filters: { electionId: "saved-election", electoralZoneId: "zone-1", severity: "CRITICAL" },
      metricsJson: ["incidentsOpenedCritical"],
      granularity: "day",
      owner: { id: "owner-1", name: "Supervisor" },
    };
    const { controller, service } = setup(saved);
    const res = response();
    await controller.csv({ viewId: "view-1", electionId: "ignored-election" }, request(), res);
    expect(service.csv).toHaveBeenCalledWith(
      { electionId: "saved-election", zoneId: "zone-1", severity: "CRITICAL" },
      expect.objectContaining({ name: saved.name, ownerName: "Supervisor", metrics: ["incidentsOpenedCritical"] }),
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=relatorio-criticos-zona-sao-paulo.csv");
  });

  it("aplica a mesma resolucao ao PDF", async () => {
    const saved = { ownerId: "user-1", name: "Minha visão", shared: false, filters: {}, metricsJson: [], granularity: "week", owner: { name: "Operador" } };
    const { controller, service } = setup(saved);
    const res = response();
    await controller.pdf({ viewId: "view-1" }, request(), res);
    expect(service.pdf).toHaveBeenCalledWith({}, expect.objectContaining({ granularity: "week" }));
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=relatorio-minha-visao.pdf");
  });
});