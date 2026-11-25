import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  AssetStatus,
  ClosureExceptionStatus,
  ClosureItemCategory,
  ClosureItemStatus,
  ClosureReconciliationStatus as Status,
  ClosureSeverity,
  ClosureSignoffRole,
  DeliveryStatus,
  EvidenceLinkType,
  FieldDispatchStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { ClosureReconciliationService } from "./closure-reconciliation.service";

const updatedAt = new Date("2026-11-18T11:00:00.000Z");
const detectedAt = new Date("2026-11-18T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(updatedAt);
});
afterEach(() => vi.useRealTimers());

function exception(overrides: Record<string, unknown> = {}) {
  return {
    id: "exception-1", status: ClosureExceptionStatus.REGISTERED,
    registeredById: "author-1", approvedById: null, validUntil: null,
    itemId: null, category: ClosureItemCategory.EVIDENCE, mitigation: null,
    item: null, ...overrides,
  };
}

const minimumSignoffs = [
  { role: ClosureSignoffRole.OPERATIONS_LEAD },
  { role: ClosureSignoffRole.LOGISTICS },
];

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    electionId: "election-1",
    electoralZoneId: null,
    code: "ENC-2026-001",
    status: Status.COLLECTING,
    notes: null,
    closureReason: null,
    assetsUnreturned: 0,
    deliveriesPending: 0,
    dispatchesOpen: 0,
    evidenceMissing: 0,
    exceptionsOpen: 0,
    exceptionsAccepted: 0,
    exceptionsExpired: 0,
    blockingItems: 0,
    readinessScore: 100,
    lastRefreshedAt: detectedAt,
    submittedAt: null,
    approvedAt: null,
    closedAt: null,
    cancelledAt: null,
    createdById: "author-1",
    submittedById: null,
    approvedById: null,
    closedById: null,
    createdAt: detectedAt,
    updatedAt,
    election: { id: "election-1", name: "Pleito 2026", year: 2026 },
    electoralZone: null,
    items: [] as ReturnType<typeof item>[],
    exceptions: [] as ReturnType<typeof exception>[],
    signoffs: [] as Array<{ role: ClosureSignoffRole; userId?: string }>,
    history: [],
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    reconciliationId: "rec-1",
    category: ClosureItemCategory.ASSET_RETURN as ClosureItemCategory,
    sourceType: "ASSET_ASSIGNMENT",
    sourceId: "assignment-1",
    referenceLabel: "AT-1 · Urna",
    title: "Ativo não devolvido: Urna",
    detail: null,
    severity: ClosureSeverity.HIGH,
    blocking: true,
    status: ClosureItemStatus.PENDING as ClosureItemStatus,
    dueAt: null,
    detectedAt,
    lastSeenAt: detectedAt,
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
    payload: null,
    ...overrides,
  };
}

function setup(current = row()) {
  const prisma = {
    election: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "election-1", name: "Pleito 2026", year: 2026 }),
    },
    electoralZone: { findFirst: vi.fn().mockResolvedValue({ id: "zone-1" }) },
    user: {
      findUnique: vi.fn().mockResolvedValue({ name: "Maria Souza" }),
      findFirst: vi.fn().mockResolvedValue({ name: "Maria Souza" }),
    },
    closureReconciliation: {
      findUnique: vi.fn().mockResolvedValue(current),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([current]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockImplementation(async ({ where }) => ({
        count: where.id === current.id && where.updatedAt.getTime() === current.updatedAt.getTime() ? 1 : 0,
      })),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...current, ...data }),
        ),
    },
    closureReconciliationItem: {
      findMany: vi.fn().mockResolvedValue(current.items),
      findFirst: vi.fn().mockResolvedValue(current.items[0]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    closureReconciliationException: {
      findMany: vi.fn().mockResolvedValue(current.exceptions),
      create: vi.fn().mockResolvedValue({ id: "exception-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    closureReconciliationSignoff: {
      findMany: vi.fn().mockResolvedValue(current.signoffs),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    closureReconciliationHistory: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    assetAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    delivery: { findMany: vi.fn().mockResolvedValue([]) },
    fieldDispatch: { findMany: vi.fn().mockResolvedValue([]) },
    evidenceLink: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi
      .fn()
      .mockImplementation(async (value: unknown) =>
        Array.isArray(value)
          ? Promise.all(value)
          : (value as (tx: unknown) => Promise<unknown>)(prisma),
      ),
  };
  const bus = { emit: vi.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    bus,
    service: new ClosureReconciliationService(
      prisma as unknown as PrismaService,
      bus as never,
    ),
  };
}

const assignment = {
  id: "assignment-1",
  purpose: "Distribuição de urna",
  assignedToName: "João Lima",
  destinationLabel: "Escola Municipal",
  expectedReturnAt: new Date("2026-11-17T10:00:00.000Z"),
  assignedAt: detectedAt,
  asset: {
    id: "asset-1",
    assetTag: "AT-1",
    name: "Urna",
    status: AssetStatus.IN_USE,
  },
  pollingPlace: { name: "Escola Municipal" },
  electoralZone: { number: 12 },
};

// Persistência em memória para observar transições reais do serviço. Não simula
// isolamento transacional, constraints ou concorrência do PostgreSQL.
function stateful(current = row()) {
  const context = setup(current);
  const { prisma } = context;
  prisma.$transaction.mockImplementation(async (value: unknown) => {
    const snapshot = structuredClone(current);
    try {
      return await (Array.isArray(value) ? Promise.all(value) : (value as (tx: unknown) => Promise<unknown>)(prisma));
    } catch (error) {
      Object.assign(current, snapshot);
      throw error;
    }
  });
  prisma.closureReconciliation.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.id !== current.id || where.updatedAt.getTime() !== current.updatedAt.getTime()) return { count: 0 };
    Object.assign(current, data);
    return { count: 1 };
  });
  prisma.closureReconciliation.findUnique.mockImplementation(async () =>
    structuredClone(current),
  );
  prisma.closureReconciliation.findMany.mockImplementation(async () => [structuredClone(current)]);
  prisma.closureReconciliation.create.mockImplementation(async ({ data }) => {
    Object.assign(current, data, { status: Status.DRAFT, lastRefreshedAt: null });
    return structuredClone(current);
  });
  prisma.closureReconciliation.update.mockImplementation(async ({ data }) => {
    Object.assign(current, data);
    return structuredClone(current);
  });
  prisma.closureReconciliationItem.findMany.mockImplementation(async () => structuredClone(current.items));
  prisma.closureReconciliationItem.findFirst.mockImplementation(async ({ where }) =>
    structuredClone(current.items.find((entry) => entry.id === where.id && entry.reconciliationId === where.reconciliationId)),
  );
  prisma.closureReconciliationItem.create.mockImplementation(async ({ data }) => {
    const created = item({ id: `item-${current.items.length + 1}`, ...data });
    current.items.push(created);
    return structuredClone(created);
  });
  prisma.closureReconciliationItem.update.mockImplementation(async ({ where, data }) => {
    const found = current.items.find((entry) => entry.id === where.id);
    if (!found) throw new Error(`Item de teste ausente: ${where.id}`);
    Object.assign(found, data);
    return structuredClone(found);
  });
  prisma.closureReconciliationItem.updateMany.mockImplementation(async ({ where, data }) => {
    const matches = current.items.filter((entry) => where.id.in.includes(entry.id));
    matches.forEach((entry) => Object.assign(entry, data));
    return { count: matches.length };
  });
  prisma.closureReconciliationException.findMany.mockImplementation(async () => structuredClone(current.exceptions));
  prisma.closureReconciliationException.create.mockImplementation(async ({ data }) => {
    const created = exception({ id: `exception-${current.exceptions.length + 1}`, ...data });
    current.exceptions.push(created);
    return structuredClone(created);
  });
  prisma.closureReconciliationException.update.mockImplementation(async ({ where, data }) => {
    const found = current.exceptions.find((entry) => entry.id === where.id);
    if (!found) throw new Error(`Exceção de teste ausente: ${where.id}`);
    Object.assign(found, data);
    return structuredClone(found);
  });
  prisma.closureReconciliationSignoff.findMany.mockImplementation(async () => structuredClone(current.signoffs));
  prisma.closureReconciliationSignoff.upsert.mockImplementation(async ({ create, update }) => {
    const found = current.signoffs.find((entry) => entry.role === create.role && entry.userId === create.userId);
    if (found) Object.assign(found, update);
    else current.signoffs.push(create);
    return found ?? create;
  });
  return { ...context, current, expected: { get expectedUpdatedAt() { return current.updatedAt.toISOString(); } } };
}

const expected = { expectedUpdatedAt: updatedAt.toISOString() };
const justification = "Pendência acompanhada pela equipe até a devolução programada";

const deliverySource = {
  id: "delivery-1", status: DeliveryStatus.PENDING, failureReason: null,
  receiverName: null, createdAt: detectedAt, deliveredAt: detectedAt,
  proofUrl: null, route: { code: "RT-1", name: "Rota central" },
  pollingPlace: { name: "Escola", electoralZone: { number: 12 } }, items: [],
};

const dispatchSource = {
  id: "dispatch-1", title: "Recolher material", status: FieldDispatchStatus.REQUESTED,
  priority: "HIGH", requestedAt: new Date("2026-11-01T10:00:00Z"),
  locationLabel: "Escola", team: { id: "team-1", name: "Equipe", code: "EQ-1" },
  member: null, pollingPlace: null, electoralZone: null,
};

describe("ClosureReconciliationService — fluxo operacional persistido em memória", () => {
  it("abre, detecta, trata, assina, submete, aprova e encerra preservando decisões", async () => {
    const { service, prisma, current, bus, expected } = stateful();
    expect((await service.create({ electionId: "election-1" }, "operator")).status).toBe(Status.DRAFT);
    prisma.assetAssignment.findMany.mockImplementation(async ({ where }) => where.problemDetected ? [] : [assignment]);
    prisma.delivery.findMany.mockImplementation(async ({ where }) => where.status === DeliveryStatus.DELIVERED ? [] : [deliverySource]);
    const detected = await service.refresh(current.id, expected.expectedUpdatedAt, "operator");
    expect(detected.status).toBe(Status.COLLECTING);
    expect(detected.evaluation.blockingItems).toBe(2);
    const asset = current.items.find((entry) => entry.category === ClosureItemCategory.ASSET_RETURN)!;
    const delivery = current.items.find((entry) => entry.category === ClosureItemCategory.DELIVERY)!;
    await service.resolveItem(current.id, delivery.id, { ...expected, resolutionNote: "Entrega confirmada com o responsável" }, "operator");
    await service.registerException(current.id, { ...expected, itemId: asset.id, risk: "MEDIUM", justification }, "operator");
    await service.acceptException(current.id, current.exceptions[0].id, expected, "exception-reviewer");
    for (const { role } of minimumSignoffs) {
      await service.signoff(current.id, { ...expected, role, statement: "Conferi as pendências e decisões de encerramento" }, `responsible-${role}`);
    }
    expect((await service.submit(current.id, expected, "operator")).status).toBe(Status.IN_REVIEW);
    await expect(service.approve(current.id, expected.expectedUpdatedAt, "operator")).rejects.toThrow(/diferente de quem submeteu/);
    expect((await service.approve(current.id, expected.expectedUpdatedAt, "aggregate-reviewer")).status).toBe(Status.READY);
    const closed = await service.close(current.id, { ...expected, closureReason: "Conferência operacional concluída com risco formalmente aceito" }, "closer");
    expect(closed).toMatchObject({ status: Status.CLOSED, closedById: "closer", blockingItems: 0 });
    expect(closed.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: asset.id, status: ClosureItemStatus.ACCEPTED }),
      expect.objectContaining({ id: delivery.id, status: ClosureItemStatus.RESOLVED, resolvedById: "operator" }),
    ]));
    expect(closed.exceptions[0]).toMatchObject({ registeredById: "operator", approvedById: "exception-reviewer" });
    expect(closed.signoffs).toHaveLength(2);
    expect(prisma.closureReconciliationHistory.create.mock.calls.map(([call]) => call.data.action)).toEqual(expect.arrayContaining([
      "CREATED", "REFRESHED", "ITEM_RESOLVED", "EXCEPTION_REGISTERED", "EXCEPTION_ACCEPTED", "SIGNOFF_ADDED", "SUBMITTED", "APPROVED", "CLOSED",
    ]));
    expect(bus.emit).toHaveBeenCalledWith("closure_reconciliation.closed", expect.objectContaining({ actorId: "closer" }));
  });

  it.each(["accept", "revoke"] as const)("só retorna à revisão após decidir a última exceção: %s", async (decision) => {
    const { service, current, expected } = stateful(row({ signoffs: minimumSignoffs }));
    for (const category of [ClosureItemCategory.EVIDENCE, ClosureItemCategory.DISPATCH]) {
      await service.registerException(current.id, { ...expected, category, risk: "LOW", justification }, "author-1");
    }
    expect((await service.submit(current.id, expected, "submitter")).status).toBe(Status.PENDING_EXCEPTIONS);
    const decide = (id: string) => decision === "accept"
      ? service.acceptException(current.id, id, expected, "reviewer")
      : service.revokeException(current.id, id, { ...expected, reason: "Exceção não necessária após conferência" }, "reviewer");
    const first = await decide(current.exceptions[0].id);
    expect(first.status).toBe(Status.PENDING_EXCEPTIONS);
    expect(first.evaluation.openExceptions).toBe(1);
    await expect(service.approve(current.id, expected.expectedUpdatedAt, "approver")).rejects.toThrow(/em revisão/);
    const last = await decide(current.exceptions[1].id);
    expect(last.status).toBe(Status.IN_REVIEW);
    expect(last.evaluation.openExceptions).toBe(0);
    expect(last.approvedAt).toBeNull();
  });

  it("detecção repetida não duplica e preserva decisões explícitas mesmo sem origem", async () => {
    const { service, prisma, current, expected } = stateful();
    prisma.assetAssignment.findMany.mockImplementation(async ({ where }) => where.problemDetected ? [] : [assignment]);
    await service.refresh(current.id, expected.expectedUpdatedAt, "operator");
    await service.refresh(current.id, expected.expectedUpdatedAt, "operator");
    expect(current.items).toHaveLength(1);
    await service.dismissItem(current.id, current.items[0].id, { ...expected, reason: "Atribuição fora do escopo após conferência" }, "operator");
    await service.refresh(current.id, expected.expectedUpdatedAt, "operator");
    expect(current.items[0].status).toBe(ClosureItemStatus.DISMISSED);
    prisma.assetAssignment.findMany.mockResolvedValue([]);
    await service.refresh(current.id, expected.expectedUpdatedAt, "operator");
    expect(current.items[0]).toMatchObject({ status: ClosureItemStatus.DISMISSED, resolvedById: "operator" });
  });

  it("bloqueia DRAFT mesmo com detecção e assinaturas preenchidas", async () => {
    const { service, prisma } = setup(row({ status: Status.DRAFT, signoffs: minimumSignoffs }));
    await expect(service.submit("rec-1", expected, "operator")).rejects.toThrow(/DRAFT/);
    expect(prisma.closureReconciliation.update).not.toHaveBeenCalled();
  });

  it.each([Status.READY, Status.CLOSED, Status.CANCELLED])("%s rejeita tratamento, detecção, exceções e assinaturas", async (status) => {
    const { service, prisma } = setup(row({ status, items: [item()], exceptions: [exception()], signoffs: minimumSignoffs }));
    const mutations = [
      () => service.refresh("rec-1", expected.expectedUpdatedAt, "operator"),
      () => service.resolveItem("rec-1", "item-1", { ...expected, resolutionNote: justification }, "operator"),
      () => service.dismissItem("rec-1", "item-1", { ...expected, reason: justification }, "operator"),
      () => service.reopenItem("rec-1", "item-1", { ...expected, reason: justification }, "operator"),
      () => service.registerException("rec-1", { ...expected, itemId: "item-1", justification, risk: "LOW" }, "operator"),
      () => service.acceptException("rec-1", "exception-1", expected, "reviewer"),
      () => service.revokeException("rec-1", "exception-1", { ...expected, reason: justification }, "reviewer"),
      () => service.signoff("rec-1", { ...expected, role: "AUDIT", statement: justification }, "operator"),
    ];
    for (const mutate of mutations) await expect(mutate()).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.closureReconciliation.update).not.toHaveBeenCalled();
    expect(prisma.closureReconciliationItem.update).not.toHaveBeenCalled();
    expect(prisma.closureReconciliationException.update).not.toHaveBeenCalled();
    expect(prisma.closureReconciliationSignoff.upsert).not.toHaveBeenCalled();
  });

  it("recusa versão antiga antes de qualquer escrita (verificação unitária, sem concorrência real)", async () => {
    const { service, prisma } = setup();
    await expect(service.update("rec-1", { expectedUpdatedAt: detectedAt.toISOString(), notes: "Cliente desatualizado" }, "operator")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.closureReconciliation.update).not.toHaveBeenCalled();
    expect(prisma.closureReconciliationHistory.create).not.toHaveBeenCalled();
  });

  it("resposta fornece nova versão e uma segunda edição com token antigo é recusada", async () => {
    const { service, current, expected } = stateful();
    const stale = expected.expectedUpdatedAt;
    const response = await service.update(current.id, { expectedUpdatedAt: stale, notes: "Primeira edição confirmada" }, "first-editor");
    expect(response.updatedAt.getTime()).toBeGreaterThan(new Date(stale).getTime());
    await expect(service.update(current.id, { expectedUpdatedAt: stale, notes: "Edição desatualizada" }, "second-editor")).rejects.toBeInstanceOf(ConflictException);
    expect(current.notes).toBe("Primeira edição confirmada");
  });

  it("revogar exceção de item impede aprovação até novo tratamento", async () => {
    const { service, current, expected } = stateful(row({ items: [item()], signoffs: minimumSignoffs }));
    await service.registerException(current.id, { ...expected, itemId: "item-1", risk: "HIGH", justification }, "operator");
    await service.submit(current.id, expected, "operator");
    const result = await service.revokeException(current.id, current.exceptions[0].id, { ...expected, reason: "Mitigação insuficiente para aceitar o risco" }, "reviewer");
    expect(result.status).toBe(Status.IN_REVIEW);
    expect(result.evaluation.blockingItems).toBe(1);
    await expect(service.approve(current.id, expected.expectedUpdatedAt, "reviewer")).rejects.toThrow(/impeditiv/);
  });
});

describe("ClosureReconciliationService — leitura dinâmica", () => {
  it("detalhe, lista e painel refletem validade vencida sem nova detecção", async () => {
    const { service, prisma } = setup(row({
      status: Status.READY, signoffs: minimumSignoffs,
      exceptions: [exception({ status: ClosureExceptionStatus.ACCEPTED, validUntil: new Date("2026-11-18T12:00:00Z") })],
    }));
    expect((await service.get("rec-1")).exceptionsExpired).toBe(0);
    vi.setSystemTime(new Date("2026-11-18T12:01:00Z"));
    expect(await service.get("rec-1")).toMatchObject({ exceptionsExpired: 1, evaluation: { readyToClose: false } });
    expect((await service.list({}))[0].exceptionsExpired).toBe(1);
    expect((await service.dashboard({})).attention[0].exceptionsExpired).toBe(1);
    await expect(service.close("rec-1", { ...expected, closureReason: justification }, "closer")).rejects.toThrow(/validade vencida/);
    expect(prisma.closureReconciliation.update).not.toHaveBeenCalled();
  });

  it("painel recalcula pendências e prontidão em vez de confiar em contadores persistidos", async () => {
    const { service, prisma } = setup();
    prisma.closureReconciliation.findMany.mockResolvedValue([
      row({ items: [item()], blockingItems: 0, assetsUnreturned: 0, readinessScore: 100 }),
      row({ id: "closed", status: Status.CLOSED, items: [item()], blockingItems: 99 }),
    ]);
    const panel = await service.dashboard({});
    expect(panel.pending).toMatchObject({ assetsUnreturned: 1, blockingItems: 1 });
    expect(panel.averageReadiness).toBe(0);
    expect(panel.attention.map((entry) => entry.id)).toEqual(["rec-1"]);
  });

  it.each([Status.COLLECTING, Status.IN_REVIEW, Status.READY])("painel sinaliza decisão humana pendente em %s mesmo sem itens", async (status) => {
    const { service } = setup(row({ status, signoffs: status === Status.COLLECTING ? [] : minimumSignoffs }));
    expect((await service.dashboard({})).attention.map((entry) => entry.id)).toContain("rec-1");
  });
});

describe("ClosureReconciliationService — abertura", () => {
  it("gera códigos distintos para eleições diferentes do mesmo ano", async () => {
    const { service, prisma } = setup();
    const created: Array<{ electionId: string; code: string }> = [];
    prisma.election.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, name: "Pleito", year: 2026 }));
    prisma.closureReconciliation.count.mockImplementation(async (query) => created.filter((entry) => !query?.where?.electionId || entry.electionId === query.where.electionId).length);
    prisma.closureReconciliation.create.mockImplementation(async ({ data }) => {
      created.push(data);
      return row(data);
    });
    await service.create({ electionId: "election-1" }, "operator");
    await service.create({ electionId: "election-2" }, "operator");
    expect(created).toHaveLength(2);
    expect(new Set(created.map((entry) => entry.code)).size).toBe(2);
  });

  it.each([null, "zone-1"])("unicidade ativa respeita o escopo %s e permite complementar encerrada", async (zone) => {
    const { service, prisma } = setup();
    const existing = row({ electoralZoneId: zone, status: Status.CLOSED });
    prisma.closureReconciliation.findFirst.mockImplementation(async ({ where }) =>
      where.electionId === existing.electionId && where.electoralZoneId === existing.electoralZoneId && !where.status.notIn.includes(existing.status)
        ? existing : null,
    );
    const request = { electionId: "election-1", electoralZoneId: zone ?? undefined };
    await expect(service.create(request, "operator")).resolves.toBeDefined();
    existing.status = Status.COLLECTING;
    await expect(service.create(request, "operator")).rejects.toThrow(/conciliação ativa/);
    await expect(service.create({ ...request, electoralZoneId: "other-zone" }, "operator")).resolves.toBeDefined();
  });

  it("recusa segunda conciliação ativa para o mesmo pleito e escopo", async () => {
    const { prisma, service } = setup();
    prisma.closureReconciliation.findFirst.mockResolvedValue({ id: "rec-1" });
    await expect(
      service.create({ electionId: "election-1" }, "actor-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("não reabre encerrada quando já existe uma complementar ativa no mesmo escopo", async () => {
    const { service, prisma } = setup(row({ status: Status.CLOSED }));
    prisma.closureReconciliation.findFirst.mockResolvedValue({ id: "complementary-active" });
    await expect(service.reopen("rec-1", { ...expected, reason: "Conferência complementar solicitada" }, "operator")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.closureReconciliation.update).not.toHaveBeenCalled();
    expect(prisma.closureReconciliationHistory.create).not.toHaveBeenCalled();
  });

  it("cria conciliação com código identificado pelo ano e histórico", async () => {
    const { prisma, bus, service } = setup();
    prisma.closureReconciliation.count.mockResolvedValue(2);
    const created = await service.create(
      { electionId: "election-1", notes: "Fechamento do turno" },
      "actor-1",
    );
    expect(prisma.closureReconciliation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        electionId: "election-1",
        code: expect.stringMatching(/^ENC-2026-/),
        notes: "Fechamento do turno",
        createdById: "actor-1",
      }),
    });
    expect(prisma.closureReconciliationHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CREATED", actorId: "actor-1" }),
    });
    expect(bus.emit).toHaveBeenCalledWith(
      "closure_reconciliation.created",
      expect.objectContaining({
        reconciliationId: created.id,
        code: expect.any(String),
      }),
    );
  });
});

describe("ClosureReconciliationService — detecção", () => {
  it.each([ClosureItemStatus.EXCEPTION, ClosureItemStatus.ACCEPTED])("detecção preserva decisão %s com origem presente e ausente", async (status) => {
    const { service, prisma, current, expected } = stateful(row({ items: [item({ status })] }));
    prisma.assetAssignment.findMany.mockImplementation(async ({ where }) => where.problemDetected ? [] : [assignment]);
    await service.refresh("rec-1", expected.expectedUpdatedAt, "operator");
    expect(current.items[0].status).toBe(status);
    prisma.assetAssignment.findMany.mockResolvedValue([]);
    await service.refresh("rec-1", expected.expectedUpdatedAt, "operator");
    expect(current.items[0].status).toBe(status);
    expect(current.items).toHaveLength(1);
  });

  it.each([
    [null, AssetStatus.IN_USE, ClosureSeverity.MEDIUM],
    [new Date("2026-11-19T10:00:00Z"), AssetStatus.IN_USE, ClosureSeverity.MEDIUM],
    [new Date("2026-11-17T10:00:00Z"), AssetStatus.IN_USE, ClosureSeverity.HIGH],
    [null, AssetStatus.LOST, ClosureSeverity.CRITICAL],
  ])("classifica ativo com prazo %s e estado %s como %s", async (deadline, status, severity) => {
    const { service, prisma, current, expected } = stateful();
    prisma.assetAssignment.findMany.mockImplementation(async ({ where }) => where.problemDetected ? [] : [{ ...assignment, expectedReturnAt: deadline, asset: { ...assignment.asset, status } }]);
    await service.refresh("rec-1", expected.expectedUpdatedAt, "operator");
    expect(current.items[0]).toMatchObject({ severity, blocking: true });
  });

  it.each([
    [FieldDispatchStatus.REQUESTED, ClosureSeverity.MEDIUM],
    [FieldDispatchStatus.IN_PROGRESS, ClosureSeverity.HIGH],
    [FieldDispatchStatus.ARRIVED, ClosureSeverity.HIGH],
  ])("despacho %s tem severidade %s mesmo solicitado há vários dias", async (status, severity) => {
    const { service, prisma, current, expected } = stateful();
    prisma.fieldDispatch.findMany.mockResolvedValue([{ ...dispatchSource, status }]);
    await service.refresh("rec-1", expected.expectedUpdatedAt, "operator");
    expect(current.items[0]).toMatchObject({ category: ClosureItemCategory.DISPATCH, severity, blocking: true });
  });

  it("detecta evidência de entrega e agrupa devoluções por ativo; vínculos resolvem as duas origens", async () => {
    const { service, prisma, current, expected } = stateful();
    prisma.delivery.findMany.mockImplementation(async ({ where }) => where.status === DeliveryStatus.DELIVERED ? [{ ...deliverySource, status: DeliveryStatus.DELIVERED }] : []);
    prisma.assetAssignment.findMany.mockImplementation(async ({ where }) => where.problemDetected ? ["return-1", "return-2"].map((id) => ({ id, assetId: "asset-1", endedAt: detectedAt, returnNotes: "Avaria", asset: assignment.asset })) : []);
    await service.refresh("rec-1", expected.expectedUpdatedAt, "operator");
    expect(current.items).toHaveLength(2);
    expect(current.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "DELIVERY_EVIDENCE", sourceId: "delivery-1", blocking: false, severity: ClosureSeverity.MEDIUM }),
      expect.objectContaining({ sourceType: "ASSET_EVIDENCE", sourceId: "asset-1", blocking: false, severity: ClosureSeverity.MEDIUM }),
    ]));
    prisma.evidenceLink.findMany.mockImplementation(async ({ where }) => [{ targetId: where.type === EvidenceLinkType.DELIVERY ? "delivery-1" : "asset-1" }]);
    await service.refresh("rec-1", expected.expectedUpdatedAt, "operator");
    expect(current.items.every((entry) => entry.status === ClosureItemStatus.RESOLVED)).toBe(true);
    expect(current.evidenceMissing).toBe(0);
  });

  it.each(["ASSET_ASSIGNMENT", "DELIVERY", "FIELD_DISPATCH", "DELIVERY_EVIDENCE", "ASSET_EVIDENCE"])("varre mais de mil origens %s sem resolver falsamente o último item", async (sourceType) => {
    const category = sourceType === "ASSET_ASSIGNMENT" ? ClosureItemCategory.ASSET_RETURN
      : sourceType === "DELIVERY" ? ClosureItemCategory.DELIVERY
      : sourceType === "FIELD_DISPATCH" ? ClosureItemCategory.DISPATCH : ClosureItemCategory.EVIDENCE;
    const last = item({ sourceType, sourceId: "source-1000", category });
    const { service, prisma, current } = stateful(row({ items: [last] }));
    // O double respeita limites de consulta: não devolve 1001 registros quando
    // o produto pediu apenas 1000. Aceita paginação por offset ou cursor.
    const page = <T extends { id: string }>(rows: T[], query: { take?: number; skip?: number; cursor?: { id: string } }) => {
      const offset = (query.cursor ? rows.findIndex((entry) => entry.id === query.cursor!.id) : 0) + (query.skip ?? 0);
      return rows.slice(offset, query.take === undefined ? undefined : offset + query.take);
    };
    const ids = Array.from({ length: 1001 }, (_, i) => `source-${i}`);
    prisma.assetAssignment.findMany.mockImplementation(async (query) => {
      if (query.where.problemDetected) return sourceType === "ASSET_EVIDENCE" ? page(ids.map((id) => ({ id, assetId: id, endedAt: detectedAt, returnNotes: null, asset: assignment.asset })), query) : [];
      return sourceType === "ASSET_ASSIGNMENT" ? page(ids.map((id) => ({ ...assignment, id })), query) : [];
    });
    prisma.delivery.findMany.mockImplementation(async (query) => {
      const isEvidence = query.where.status === DeliveryStatus.DELIVERED;
      return (isEvidence ? sourceType === "DELIVERY_EVIDENCE" : sourceType === "DELIVERY") ? page(ids.map((id) => ({ ...deliverySource, id })), query) : [];
    });
    prisma.fieldDispatch.findMany.mockImplementation(async (query) => sourceType === "FIELD_DISPATCH" ? page(ids.map((id) => ({ ...dispatchSource, id })), query) : []);
    await service.refresh("rec-1", expected.expectedUpdatedAt, "operator");
    expect(current.items.find((entry) => entry.sourceId === "source-1000")?.status).toBe(ClosureItemStatus.PENDING);
    expect(current.items).toHaveLength(1001);
    expect(current.items.filter((entry) => entry.status === ClosureItemStatus.RESOLVED)).toHaveLength(0);
  });

  it("falha de leitura de fonte não resolve itens nem marca detecção concluída", async () => {
    const { service, prisma, current } = stateful(row({ items: [item()] }));
    prisma.fieldDispatch.findMany.mockRejectedValue(new Error("Fonte indisponível"));
    await expect(service.refresh("rec-1", expected.expectedUpdatedAt, "operator")).rejects.toThrow("Fonte indisponível");
    expect(current.items[0].status).toBe(ClosureItemStatus.PENDING);
    expect(prisma.closureReconciliationItem.updateMany).not.toHaveBeenCalled();
    expect(prisma.closureReconciliation.update).not.toHaveBeenCalled();
  });

  it("converte ativo em uso vencido em item impeditivo de alta severidade", async () => {
    const { prisma, bus, service } = setup();
    prisma.assetAssignment.findMany.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.problemDetected ? [] : [assignment]),
    );

    await service.refresh("rec-1", updatedAt.toISOString(), "actor-1");

    expect(prisma.closureReconciliationItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reconciliationId: "rec-1",
        category: ClosureItemCategory.ASSET_RETURN,
        sourceType: "ASSET_ASSIGNMENT",
        sourceId: "assignment-1",
        referenceLabel: expect.stringContaining("AT-1 · Urna"),
        severity: ClosureSeverity.HIGH,
        blocking: true,
      }),
    });
    expect(prisma.closureReconciliation.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: expect.objectContaining({ lastRefreshedAt: expect.any(Date) }),
    });
    expect(bus.emit).toHaveBeenCalledWith(
      "closure_reconciliation.refreshed",
      expect.objectContaining({ reconciliationId: "rec-1" }),
    );
  });

  it("não duplica item existente e encerra pendência cuja origem desapareceu", async () => {
    const existing = item();
    const stale = item({
      id: "item-2",
      category: ClosureItemCategory.DELIVERY,
      sourceType: "DELIVERY",
      sourceId: "delivery-9",
      referenceLabel: "RT-1 · Local",
    });
    const { prisma, service } = setup(row({ items: [existing, stale] }));
    prisma.assetAssignment.findMany.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.problemDetected ? [] : [assignment]),
    );

    await service.refresh("rec-1", updatedAt.toISOString(), "actor-1");

    expect(prisma.closureReconciliationItem.create).not.toHaveBeenCalled();
    expect(prisma.closureReconciliationItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: expect.objectContaining({
        severity: ClosureSeverity.HIGH,
        lastSeenAt: expect.any(Date),
      }),
    });
    expect(prisma.closureReconciliationItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-2"] } },
      data: expect.objectContaining({
        status: ClosureItemStatus.RESOLVED,
        resolutionNote: expect.stringContaining("detecção automática"),
      }),
    });
  });

  it("reabre item resolvido quando a origem volta a aparecer", async () => {
    const resolved = item({
      status: ClosureItemStatus.RESOLVED,
      resolvedAt: detectedAt,
      resolvedById: "actor-2",
      resolutionNote: "Devolvido",
    });
    const { prisma, service } = setup(row({ items: [resolved] }));
    prisma.assetAssignment.findMany.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.problemDetected ? [] : [assignment]),
    );

    await service.refresh("rec-1", updatedAt.toISOString(), "actor-1");

    expect(prisma.closureReconciliationItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: expect.objectContaining({
        status: ClosureItemStatus.PENDING,
        resolvedAt: null,
        resolvedById: null,
        resolutionNote: null,
      }),
    });
  });

  it("detecta entrega pendente com severidade alta quando falhou", async () => {
    const { prisma, service } = setup();
    const delivery = {
      id: "delivery-1",
      status: DeliveryStatus.FAILED,
      failureReason: "Destino fechado",
      receiverName: null,
      createdAt: detectedAt,
      route: { code: "RT-1", name: "Rota centro" },
      pollingPlace: {
        name: "Escola Municipal",
        electoralZone: { number: 12 },
      },
      items: [{ description: "Urna", quantity: 2 }],
    };
    prisma.delivery.findMany.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          where.status === DeliveryStatus.DELIVERED ? [] : [delivery],
        ),
    );

    await service.refresh("rec-1", updatedAt.toISOString(), "actor-1");

    expect(prisma.closureReconciliationItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: ClosureItemCategory.DELIVERY,
        severity: ClosureSeverity.HIGH,
        detail: expect.stringContaining("Falha: Destino fechado"),
      }),
    });
  });
});

describe("ClosureReconciliationService — exceções", () => {
  it("registra exceção vinculada e move item para EXCEPTION", async () => {
    const pending = item();
    const { prisma, bus, service } = setup(row({ items: [pending] }));

    await service.registerException(
      "rec-1",
      {
        expectedUpdatedAt: updatedAt.toISOString(),
        itemId: "item-1",
        risk: "HIGH",
        justification:
          "Ativo permanece em uso por decisão operacional justificada",
        mitigation: "Devolução acompanhada por auditoria",
      },
      "actor-1",
    );

    expect(prisma.closureReconciliationException.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reconciliationId: "rec-1",
        itemId: "item-1",
        category: ClosureItemCategory.ASSET_RETURN,
        risk: "HIGH",
        registeredById: "actor-1",
        registeredByName: "Maria Souza",
      }),
    });
    expect(prisma.closureReconciliationItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { status: ClosureItemStatus.EXCEPTION },
    });
    expect(bus.emit).toHaveBeenCalledWith(
      "closure_reconciliation.exception_registered",
      expect.objectContaining({ exceptionId: "exception-1" }),
    );
  });

  it("recusa validade de exceção no passado", async () => {
    const { service } = setup(row({ items: [item()] }));
    await expect(
      service.registerException(
        "rec-1",
        {
          expectedUpdatedAt: updatedAt.toISOString(),
          itemId: "item-1",
          risk: "MEDIUM",
          justification:
            "Justificativa suficientemente longa para o cenário de teste",
          validUntil: "2020-01-01T00:00:00.000Z",
        },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("impede autoaprovação da exceção registrada", async () => {
    const { prisma, service } = setup(
      row({
        exceptions: [
          {
            id: "exception-1",
            status: ClosureExceptionStatus.REGISTERED,
            registeredById: "actor-1",
            itemId: null,
            category: ClosureItemCategory.EVIDENCE,
            mitigation: null,
            item: null,
          },
        ],
      }),
    );
    await expect(
      service.acceptException(
        "rec-1",
        "exception-1",
        { expectedUpdatedAt: updatedAt.toISOString() },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.closureReconciliationException.update).not.toHaveBeenCalled();
  });

  it("aprova exceção com usuário distinto e aceita o item vinculado", async () => {
    const { prisma, service } = setup(
      row({
        exceptions: [
          {
            id: "exception-1",
            status: ClosureExceptionStatus.REGISTERED,
            registeredById: "actor-1",
            itemId: "item-1",
            category: ClosureItemCategory.ASSET_RETURN,
            mitigation: "Auditoria",
            item: { referenceLabel: "AT-1 · Urna" },
          },
        ],
      }),
    );

    await service.acceptException(
      "rec-1",
      "exception-1",
      { expectedUpdatedAt: updatedAt.toISOString(), note: "Risco aceito" },
      "reviewer-1",
    );

    expect(
      prisma.closureReconciliationException.update,
    ).toHaveBeenCalledWith({
      where: { id: "exception-1" },
      data: expect.objectContaining({
        status: ClosureExceptionStatus.ACCEPTED,
        approvedById: "reviewer-1",
        approvedAt: expect.any(Date),
      }),
    });
    expect(prisma.closureReconciliationItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { status: ClosureItemStatus.ACCEPTED },
    });
  });

  it("revoga exceção e devolve o item para PENDING", async () => {
    const { prisma, service } = setup(
      row({
        exceptions: [
          {
            id: "exception-1",
            status: ClosureExceptionStatus.ACCEPTED,
            registeredById: "actor-1",
            itemId: "item-1",
            category: ClosureItemCategory.ASSET_RETURN,
            mitigation: null,
            item: null,
          },
        ],
      }),
    );

    await service.revokeException(
      "rec-1",
      "exception-1",
      {
        expectedUpdatedAt: updatedAt.toISOString(),
        reason: "Evidência complementar recebida",
      },
      "reviewer-1",
    );

    expect(prisma.closureReconciliationItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { status: ClosureItemStatus.PENDING },
    });
  });
});

describe("ClosureReconciliationService — transições", () => {
  it("bloqueia submissão sem detecção registrada", async () => {
    const { service } = setup(row({ lastRefreshedAt: null }));
    await expect(
      service.submit(
        "rec-1",
        { expectedUpdatedAt: updatedAt.toISOString() },
        "actor-1",
      ),
    ).rejects.toThrow(/Sem detecção registrada/);
  });

  it("submete conciliação pronta com assinaturas mínimas", async () => {
    const { prisma, bus, service } = setup(
      row({
        signoffs: [
          { role: ClosureSignoffRole.OPERATIONS_LEAD },
          { role: ClosureSignoffRole.LOGISTICS },
        ],
      }),
    );

    await service.submit(
      "rec-1",
      { expectedUpdatedAt: updatedAt.toISOString() },
      "actor-1",
    );

    expect(prisma.closureReconciliation.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: expect.objectContaining({
        status: Status.IN_REVIEW,
        submittedById: "actor-1",
      }),
    });
    expect(bus.emit).toHaveBeenCalledWith(
      "closure_reconciliation.submitted",
      expect.objectContaining({ blockingItems: 0 }),
    );
  });

  it("submete para PENDING_EXCEPTIONS quando há exceção aberta", async () => {
    const { prisma, service } = setup(
      row({
        signoffs: [
          { role: ClosureSignoffRole.OPERATIONS_LEAD },
          { role: ClosureSignoffRole.LOGISTICS },
        ],
        exceptions: [
          { status: ClosureExceptionStatus.REGISTERED, validUntil: null },
        ],
      }),
    );

    await service.submit(
      "rec-1",
      { expectedUpdatedAt: updatedAt.toISOString() },
      "actor-1",
    );

    expect(prisma.closureReconciliation.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: expect.objectContaining({ status: Status.PENDING_EXCEPTIONS }),
    });
  });

  it("exige estado READY para encerramento", async () => {
    const { service } = setup(row({ status: Status.IN_REVIEW }));
    await expect(
      service.close(
        "rec-1",
        {
          expectedUpdatedAt: updatedAt.toISOString(),
          closureReason:
            "Encerramento operacional validado pela equipe responsável",
        },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("impede encerramento pelo mesmo usuário que aprovou exceção aceita", async () => {
    const { service } = setup(
      row({
        status: Status.READY,
        signoffs: minimumSignoffs,
        exceptions: [
          {
            status: ClosureExceptionStatus.ACCEPTED,
            validUntil: null,
            approvedById: "actor-1",
          },
        ],
      }),
    );
    await expect(
      service.close(
        "rec-1",
        {
          expectedUpdatedAt: updatedAt.toISOString(),
          closureReason:
            "Encerramento operacional validado com exceção aceita formalmente",
        },
        "actor-1",
      ),
    ).rejects.toThrow(/diferente de quem aprovou a exceção/);
  });

  it("reabre conciliação encerrada com motivo registrado", async () => {
    const { prisma, bus, service } = setup(row({ status: Status.CLOSED }));
    await service.reopen(
      "rec-1",
      {
        expectedUpdatedAt: updatedAt.toISOString(),
        reason: "Devolução registrada após o fechamento",
      },
      "actor-1",
    );
    expect(prisma.closureReconciliation.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: expect.objectContaining({ status: Status.COLLECTING }),
    });
    expect(bus.emit).toHaveBeenCalledWith(
      "closure_reconciliation.reopened",
      expect.objectContaining({ reason: expect.any(String) }),
    );
  });

  it("recusa conciliação já cancelada", async () => {
    const { service } = setup(row({ status: Status.CANCELLED }));
    await expect(
      service.resolveItem(
        "rec-1",
        "item-1",
        {
          expectedUpdatedAt: updatedAt.toISOString(),
          resolutionNote: "Tentativa em conciliação cancelada",
        },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
