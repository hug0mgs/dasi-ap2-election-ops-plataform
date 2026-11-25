import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssetStatus,
  ClosureExceptionRisk,
  ClosureExceptionStatus,
  ClosureHistoryAction,
  ClosureItemCategory,
  ClosureItemStatus,
  ClosureReconciliationStatus as Status,
  ClosureSeverity,
  ClosureSignoffRole,
  DeliveryStatus,
  EvidenceLinkType,
  FieldDispatchStatus,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import type { DomainEventName } from "@eops/event-bus";
import {
  type ClosureEvaluationResult,
  escalateSeverity,
  evaluateClosure,
} from "./closure-rules";
import type {
  AcceptExceptionDto,
  CancelClosureDto,
  CloseClosureDto,
  ClosureQueryDto,
  CreateClosureDto,
  DismissItemDto,
  ReopenClosureDto,
  ReopenItemDto,
  RegisterExceptionDto,
  ResolveItemDto,
  RevokeExceptionDto,
  SignoffDto,
  SubmitClosureDto,
  UpdateClosureDto,
} from "./dto/closure-reconciliation.dto";

const include = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true } },
  items: {
    orderBy: [{ blocking: "desc" }, { severity: "desc" }, { detectedAt: "asc" }],
  },
  exceptions: {
    orderBy: { createdAt: "desc" },
    include: {
      item: { select: { id: true, referenceLabel: true, title: true } },
    },
  },
  signoffs: { orderBy: { signedAt: "asc" } },
  history: { orderBy: { createdAt: "desc" }, take: 200 },
} satisfies Prisma.ClosureReconciliationInclude;

const EDITED_STATUSES: readonly Status[] = [
  Status.DRAFT,
  Status.COLLECTING,
  Status.IN_REVIEW,
  Status.PENDING_EXCEPTIONS,
];

const TREATED_ITEM_STATUSES: readonly ClosureItemStatus[] = [
  ClosureItemStatus.RESOLVED,
  ClosureItemStatus.DISMISSED,
];

const PENDING_DELIVERY: readonly DeliveryStatus[] = [
  DeliveryStatus.PENDING,
  DeliveryStatus.IN_TRANSIT,
  DeliveryStatus.FAILED,
];

const OPEN_DISPATCH: readonly FieldDispatchStatus[] = [
  FieldDispatchStatus.REQUESTED,
  FieldDispatchStatus.DISPATCHED,
  FieldDispatchStatus.ACCEPTED,
  FieldDispatchStatus.EN_ROUTE,
  FieldDispatchStatus.ARRIVED,
  FieldDispatchStatus.IN_PROGRESS,
];

const RULES = [
  {
    category: ClosureItemCategory.ASSET_RETURN,
    label: "Ativos não devolvidos",
    blocking: true,
    description:
      "Atribuições de ativo sem devolução registrada. Vencidas ou com ativo perdido sobem de severidade.",
    sources: ["inventory/AssetAssignment"],
  },
  {
    category: ClosureItemCategory.DELIVERY,
    label: "Entregas pendentes",
    blocking: true,
    description:
      "Entregas de rota do pleito em PENDING, IN_TRANSIT ou FAILED até confirmação de destinatário.",
    sources: ["routes/Delivery"],
  },
  {
    category: ClosureItemCategory.DISPATCH,
    label: "Despachos abertos",
    blocking: true,
    description:
      "Despachos de campo fora de COMPLETED, REJECTED ou CANCELLED.",
    sources: ["field-teams/FieldDispatch"],
  },
  {
    category: ClosureItemCategory.EVIDENCE,
    label: "Evidências faltantes",
    blocking: false,
    description:
      "Entrega concluída sem comprovante e devolução com problema sem evidência vinculada. Não impede sozinho, mas reduz a prontidão.",
    sources: ["documents-evidence/EvidenceLink", "routes/Delivery"],
  },
];

interface DetectedItem {
  category: ClosureItemCategory;
  sourceType: string;
  sourceId: string;
  referenceLabel: string;
  title: string;
  detail?: string;
  severity: ClosureSeverity;
  blocking: boolean;
  dueAt?: Date | null;
  payload?: Prisma.InputJsonValue;
}

interface Scope {
  electionId: string;
  electoralZoneId: string | null;
}

@Injectable()
export class ClosureReconciliationService {
  private transactional = false;
  private pendingEvents: Array<() => Promise<void>> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  // A guarda adquire o bloqueio da linha antes de qualquer leitura ou escrita
  // do agregado. Histórico, métricas e itens participam da mesma transação.
  private async mutate<T>(
    id: string,
    expectedUpdatedAt: string,
    work: (service: ClosureReconciliationService) => Promise<T>,
  ): Promise<T> {
    const events: Array<() => Promise<void>> = [];
    const result = await this.prisma.$transaction(async (tx) => {
      const expected = new Date(expectedUpdatedAt);
      const next = new Date(Math.max(Date.now(), expected.getTime() + 1));
      const guard = await tx.closureReconciliation.updateMany({
        where: { id, updatedAt: expected },
        data: { updatedAt: next },
      });
      if (!guard.count) {
        const exists = await tx.closureReconciliation.findUnique({
          where: { id }, select: { id: true },
        });
        if (!exists) throw new NotFoundException("Conciliação não encontrada");
        throw new ConflictException(
          "Conciliação alterada por outro usuário; recarregue antes de continuar",
        );
      }
      // O serviço transacional usa apenas delegates; transações internas
      // passam por atomic(), que reutiliza este cliente sem aninhamento.
      const scoped = new ClosureReconciliationService(tx as PrismaService, this.bus);
      scoped.transactional = true;
      scoped.pendingEvents = events;
      const value = await work(scoped);
      await tx.closureReconciliation.update({ where: { id }, data: { updatedAt: next } });
      return { ...value, updatedAt: next };
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      this.rethrowConcurrency(error);
    });
    for (const event of events) await event();
    return result;
  }

  private atomic<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.transactional ? work(this.prisma) : this.prisma.$transaction(work);
  }

  private rethrowConcurrency(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new ConflictException("Conciliação alterada durante a operação; recarregue e tente novamente");
    }
    throw error;
  }

  update(id: string, d: UpdateClosureDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.updateWithin(id, d, actorId));
  }
  refresh(id: string, expected: string, actorId: string) {
    return this.mutate(id, expected, (s) => s.refreshWithin(id, expected, actorId));
  }
  resolveItem(id: string, itemId: string, d: ResolveItemDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.resolveItemWithin(id, itemId, d, actorId));
  }
  dismissItem(id: string, itemId: string, d: DismissItemDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.dismissItemWithin(id, itemId, d, actorId));
  }
  reopenItem(id: string, itemId: string, d: ReopenItemDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.reopenItemWithin(id, itemId, d, actorId));
  }
  registerException(id: string, d: RegisterExceptionDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.registerExceptionWithin(id, d, actorId));
  }
  acceptException(id: string, exceptionId: string, d: AcceptExceptionDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.acceptExceptionWithin(id, exceptionId, d, actorId));
  }
  revokeException(id: string, exceptionId: string, d: RevokeExceptionDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.revokeExceptionWithin(id, exceptionId, d, actorId));
  }
  signoff(id: string, d: SignoffDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.signoffWithin(id, d, actorId));
  }
  removeSignoff(id: string, signoffId: string, expected: string, actorId: string) {
    return this.mutate(id, expected, (s) => s.removeSignoffWithin(id, signoffId, expected, actorId));
  }
  submit(id: string, d: SubmitClosureDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.submitWithin(id, d, actorId));
  }
  approve(id: string, expected: string, actorId: string, note?: string) {
    return this.mutate(id, expected, (s) => s.approveWithin(id, expected, actorId, note));
  }
  close(id: string, d: CloseClosureDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.closeWithin(id, d, actorId));
  }
  reopen(id: string, d: ReopenClosureDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.reopenWithin(id, d, actorId));
  }
  cancel(id: string, d: CancelClosureDto, actorId: string) {
    return this.mutate(id, d.expectedUpdatedAt, (s) => s.cancelWithin(id, d, actorId));
  }

  private where(q: ClosureQueryDto): Prisma.ClosureReconciliationWhereInput {
    return {
      electionId: q.electionId,
      electoralZoneId: q.electoralZoneId,
      status: q.status,
      updatedAt:
        q.from || q.to
          ? {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            }
          : undefined,
      items:
        q.category || q.severity || q.blocking !== undefined || q.itemStatus
          ? {
              some: {
                category: q.category,
                severity: q.severity,
                blocking: q.blocking,
                status: q.itemStatus,
              },
            }
          : undefined,
    };
  }

  private tags(row: {
    items: Array<{
      status: ClosureItemStatus;
      severity: ClosureSeverity;
      blocking: boolean;
    }>;
    exceptions: Array<{
      status: ClosureExceptionStatus;
      validUntil: Date | null;
    }>;
    signoffs: Array<{ role: ClosureSignoffRole }>;
    lastRefreshedAt: Date | null;
  }, options?: { allowOpenExceptions?: boolean }) {
    const evaluation = evaluateClosure({
      items: row.items,
      exceptions: row.exceptions,
      signoffs: row.signoffs,
      lastRefreshedAt: row.lastRefreshedAt,
      allowOpenExceptions: options?.allowOpenExceptions,
    });
    return evaluation;
  }

  async references() {
    const [elections, zones, users] = await Promise.all([
      this.prisma.election.findMany({
        select: { id: true, name: true, year: true, status: true },
        orderBy: [{ year: "desc" }, { name: "asc" }],
      }),
      this.prisma.electoralZone.findMany({
        select: { id: true, electionId: true, number: true, name: true },
        orderBy: [{ number: "asc" }],
      }),
      this.prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { elections, zones, users };
  }

  rules() {
    return {
      categories: RULES,
      severities: Object.values(ClosureSeverity),
      risks: Object.values(ClosureExceptionRisk),
      signoffRoles: Object.values(ClosureSignoffRole),
      minimumSignoffRoles: [
        ClosureSignoffRole.OPERATIONS_LEAD,
        ClosureSignoffRole.LOGISTICS,
      ],
      recommendedSignoffRoles: [
        ClosureSignoffRole.FIELD,
        ClosureSignoffRole.AUDIT,
      ],
    };
  }

  async list(q: ClosureQueryDto) {
    const rows = await this.prisma.closureReconciliation.findMany({
      where: this.where(q),
      include,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => this.derive(row));
  }

  async dashboard(q: ClosureQueryDto) {
    const rows = await this.list(q);
    const active = rows.filter(
      (row) => row.status !== Status.CLOSED && row.status !== Status.CANCELLED,
    );
    const items = active.flatMap((row) => row.items);
    const counting = items.filter(
      (item) => !TREATED_ITEM_STATUSES.includes(item.status),
    );
    const severity = Object.values(ClosureSeverity).reduce<
      Partial<Record<ClosureSeverity, number>>
    >((acc, value) => {
      acc[value] = counting.filter((item) => item.severity === value).length;
      return acc;
    }, {});
    const category = Object.values(ClosureItemCategory).reduce<
      Partial<Record<ClosureItemCategory, number>>
    >((acc, value) => {
      acc[value] = counting.filter((item) => item.category === value).length;
      return acc;
    }, {});

    return {
      totals: {
        reconciliations: rows.length,
        open: rows.filter(
          (row) =>
            row.status !== Status.CLOSED && row.status !== Status.CANCELLED,
        ).length,
        ready: rows.filter((row) => row.status === Status.READY).length,
        closed: rows.filter((row) => row.status === Status.CLOSED).length,
        cancelled: rows.filter((row) => row.status === Status.CANCELLED).length,
      },
      pending: {
        assetsUnreturned: active.reduce(
          (sum, row) => sum + row.assetsUnreturned,
          0,
        ),
        deliveriesPending: active.reduce(
          (sum, row) => sum + row.deliveriesPending,
          0,
        ),
        dispatchesOpen: active.reduce((sum, row) => sum + row.dispatchesOpen, 0),
        evidenceMissing: active.reduce(
          (sum, row) => sum + row.evidenceMissing,
          0,
        ),
        blockingItems: active.reduce((sum, row) => sum + row.blockingItems, 0),
        exceptionsOpen: active.reduce((sum, row) => sum + row.exceptionsOpen, 0),
      },
      severity,
      category,
      averageReadiness: active.length
        ? Math.round(
            active.reduce((sum, row) => sum + row.readinessScore, 0) /
              active.length,
          )
        : 0,
      attention: active
        .filter(
           (row) => row.evaluation.blockers.length > 0 || row.status === Status.COLLECTING ||
             row.status === Status.IN_REVIEW || row.status === Status.READY ||
             row.status === Status.PENDING_EXCEPTIONS,
        )
        .sort((a, b) => a.readinessScore - b.readinessScore)
        .slice(0, 8),
    };
  }

  async get(id: string) {
    const row = await this.prisma.closureReconciliation.findUnique({
      where: { id },
      include,
    });
    if (!row) throw new NotFoundException("Conciliação não encontrada");
    return this.derive(row);
  }

  private derive(row: Prisma.ClosureReconciliationGetPayload<{ include: typeof include }>) {
    const evaluation = this.tags(row);
    const count = (category: ClosureItemCategory) => row.items.filter(
      (item) => item.category === category && !TREATED_ITEM_STATUSES.includes(item.status),
    ).length;
    return {
      ...row, evaluation,
      assetsUnreturned: count(ClosureItemCategory.ASSET_RETURN),
      deliveriesPending: count(ClosureItemCategory.DELIVERY),
      dispatchesOpen: count(ClosureItemCategory.DISPATCH),
      evidenceMissing: count(ClosureItemCategory.EVIDENCE),
      readinessScore: evaluation.readinessScore,
      blockingItems: evaluation.blockingItems,
      exceptionsOpen: evaluation.openExceptions,
      exceptionsAccepted: evaluation.acceptedExceptions,
      exceptionsExpired: evaluation.expiredExceptions,
    };
  }

  history(id: string) {
    return this.prisma.closureReconciliationHistory.findMany({
      where: { reconciliationId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(d: CreateClosureDto, actorId: string) {
    const election = await this.prisma.election.findUnique({
      where: { id: d.electionId },
      select: { id: true, name: true, year: true },
    });
    if (!election)
      throw new BadRequestException("Pleito informado não existe");

    if (d.electoralZoneId) {
      const zone = await this.prisma.electoralZone.findFirst({
        where: { id: d.electoralZoneId, electionId: d.electionId },
        select: { id: true },
      });
      if (!zone)
        throw new BadRequestException("Zona não pertence ao pleito informado");
    }

    const code = `ENC-${election.year}-${randomUUID()}`;

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const active = await tx.closureReconciliation.findFirst({
          where: {
            electionId: d.electionId,
            electoralZoneId: d.electoralZoneId ?? null,
            status: { notIn: [Status.CLOSED, Status.CANCELLED] },
          },
          select: { id: true },
        });
        if (active) throw new ConflictException("Já existe conciliação ativa para este pleito e escopo");
        const row = await tx.closureReconciliation.create({
          data: {
            electionId: d.electionId,
            electoralZoneId: d.electoralZoneId,
            code,
            notes: d.notes,
            createdById: actorId,
          },
        });
        await tx.closureReconciliationHistory.create({
          data: {
            reconciliationId: row.id,
            action: ClosureHistoryAction.CREATED,
            actorId,
            summary: `Conciliação ${row.code} aberta para ${election.name}`,
            toStatus: Status.DRAFT,
          },
        });
        return row;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Código de conciliação já utilizado; tente novamente",
        );
      }
      this.rethrowConcurrency(error);
    }

    await this.emit("closure_reconciliation.created", created, actorId, {
      code: created.code,
    });
    return this.get(created.id);
  }

  private async updateWithin(id: string, d: UpdateClosureDto, actorId: string) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);
    await this.prisma.closureReconciliation.update({
      where: { id },
      data: { notes: d.notes, closureReason: d.closureReason },
    });
    await this.hist(id, ClosureHistoryAction.UPDATED, actorId, "Dados da conciliação atualizados");
    return this.get(id);
  }

  private async refreshWithin(id: string, expectedUpdatedAt: string, actorId: string) {
    const row = await this.current(id, expectedUpdatedAt);
    this.assertEditable(row.status);
    const now = new Date();
    const scope: Scope = {
      electionId: row.electionId,
      electoralZoneId: row.electoralZoneId,
    };

    const detected = (
      await Promise.all([
        this.detectAssets(scope, now),
        this.detectDeliveries(scope),
        this.detectDispatches(scope),
        this.detectEvidence(scope),
      ])
    ).flat();

    const result = await this.syncItems(id, row.items, detected, now);
    await this.prisma.closureReconciliation.update({
      where: { id },
      data: { lastRefreshedAt: now, ...(row.status === Status.DRAFT ? { status: Status.COLLECTING } : {}) },
    });
    const evaluation = await this.syncMetrics(id, now);
    await this.hist(
      id,
      ClosureHistoryAction.REFRESHED,
      actorId,
      `Detecção concluída: ${result.detected} pendência(s) observada(s), ${result.created} nova(s), ${result.autoResolved} encerrada(s)`,
      row.status,
      row.status === Status.DRAFT ? Status.COLLECTING : row.status,
      {
        detected: result.detected,
        created: result.created,
        updated: result.updated,
        autoResolved: result.autoResolved,
        reopened: result.reopened,
      },
    );
    await this.emit("closure_reconciliation.refreshed", row, actorId, {
      blockingItems: evaluation.blockingItems,
      readinessScore: evaluation.readinessScore,
    });
    return this.get(id);
  }

  private async resolveItemWithin(
    id: string,
    itemId: string,
    d: ResolveItemDto,
    actorId: string,
  ) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);
    const item = await this.item(id, itemId);
    if (TREATED_ITEM_STATUSES.includes(item.status))
      throw new BadRequestException("Item já está tratado");
    await this.prisma.closureReconciliationItem.update({
      where: { id: itemId },
      data: {
        status: ClosureItemStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: actorId,
        resolutionNote: d.resolutionNote,
      },
    });
    await this.hist(
      id,
      ClosureHistoryAction.ITEM_RESOLVED,
      actorId,
      `Item resolvido: ${item.referenceLabel} — ${d.resolutionNote}`,
    );
    await this.syncMetrics(id);
    return this.get(id);
  }

  private async dismissItemWithin(
    id: string,
    itemId: string,
    d: DismissItemDto,
    actorId: string,
  ) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);
    const item = await this.item(id, itemId);
    if (TREATED_ITEM_STATUSES.includes(item.status))
      throw new BadRequestException("Item já está tratado");
    await this.prisma.closureReconciliationItem.update({
      where: { id: itemId },
      data: {
        status: ClosureItemStatus.DISMISSED,
        resolvedAt: new Date(),
        resolvedById: actorId,
        resolutionNote: d.reason,
      },
    });
    await this.hist(
      id,
      ClosureHistoryAction.ITEM_DISMISSED,
      actorId,
      `Item dispensado: ${item.referenceLabel} — ${d.reason}`,
    );
    await this.syncMetrics(id);
    return this.get(id);
  }

  private async reopenItemWithin(
    id: string,
    itemId: string,
    d: ReopenItemDto,
    actorId: string,
  ) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);
    const item = await this.item(id, itemId);
    if (item.status === ClosureItemStatus.PENDING)
      throw new BadRequestException("Item já está pendente");
    await this.prisma.closureReconciliationItem.update({
      where: { id: itemId },
      data: {
        status: ClosureItemStatus.PENDING,
        resolvedAt: null,
        resolvedById: null,
        resolutionNote: null,
        lastSeenAt: new Date(),
      },
    });
    await this.hist(
      id,
      ClosureHistoryAction.ITEM_REOPENED,
      actorId,
      `Item reaberto: ${item.referenceLabel} — ${d.reason}`,
    );
    await this.syncMetrics(id);
    return this.get(id);
  }

  private async registerExceptionWithin(
    id: string,
    d: RegisterExceptionDto,
    actorId: string,
  ) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);

    const item = d.itemId ? await this.item(id, d.itemId) : null;
    if (!item && !d.category)
      throw new BadRequestException(
        "Informe o item ou a categoria da exceção",
      );
    if (item && TREATED_ITEM_STATUSES.includes(item.status))
      throw new BadRequestException(
        "Item já tratado não aceita nova exceção",
      );

    const validUntil = d.validUntil ? new Date(d.validUntil) : null;
    if (validUntil && validUntil.getTime() <= Date.now())
      throw new BadRequestException(
        "Validade da exceção deve ser posterior ao momento atual",
      );

    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true },
    });

    const category = item?.category ?? d.category!;
    const created = await this.atomic(async (tx) => {
      const exception = await tx.closureReconciliationException.create({
        data: {
          reconciliationId: id,
          itemId: item?.id,
          category,
          risk: d.risk,
          justification: d.justification,
          mitigation: d.mitigation,
          validUntil,
          registeredById: actorId,
          registeredByName: user?.name,
        },
      });
      if (item) {
        await tx.closureReconciliationItem.update({
          where: { id: item.id },
          data: { status: ClosureItemStatus.EXCEPTION },
        });
      }
      return exception;
    });

    await this.hist(
      id,
      ClosureHistoryAction.EXCEPTION_REGISTERED,
      actorId,
      item
        ? `Exceção registrada para ${item.referenceLabel}`
        : `Exceção registrada na categoria ${category}`,
      undefined,
      undefined,
      { exceptionId: created.id, risk: d.risk, category },
    );
    await this.syncMetrics(id);
    await this.emit("closure_reconciliation.exception_registered", row, actorId, {
      exceptionId: created.id,
      category,
      risk: d.risk,
    });
    return this.get(id);
  }

  private async acceptExceptionWithin(
    id: string,
    exceptionId: string,
    d: AcceptExceptionDto,
    actorId: string,
  ) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);
    const exception = row.exceptions.find((row) => row.id === exceptionId);
    if (!exception) throw new NotFoundException("Exceção não encontrada");
    if (exception.status !== ClosureExceptionStatus.REGISTERED)
      throw new BadRequestException(
        "Somente exceção registrada pode ser aprovada",
      );
    if (exception.registeredById === actorId)
      throw new BadRequestException(
        "Aprovação exige usuário diferente de quem registrou a exceção",
      );

    await this.atomic(async (tx) => {
      await tx.closureReconciliationException.update({
        where: { id: exceptionId },
        data: {
          status: ClosureExceptionStatus.ACCEPTED,
          approvedById: actorId,
          approvedAt: new Date(),
        },
      });
      if (exception.itemId) {
        await tx.closureReconciliationItem.update({
          where: { id: exception.itemId },
          data: { status: ClosureItemStatus.ACCEPTED },
        });
      }
    });

    await this.hist(
      id,
      ClosureHistoryAction.EXCEPTION_ACCEPTED,
      actorId,
      `Exceção aprovada${
        exception.item?.referenceLabel
          ? ` para ${exception.item.referenceLabel}`
          : ""
      }${d.note ? ` — ${d.note}` : ""}`,
    );
    await this.syncMetrics(id);
    return this.get(id);
  }

  private async revokeExceptionWithin(
    id: string,
    exceptionId: string,
    d: RevokeExceptionDto,
    actorId: string,
  ) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);
    const exception = row.exceptions.find((row) => row.id === exceptionId);
    if (!exception) throw new NotFoundException("Exceção não encontrada");
    if (exception.status === ClosureExceptionStatus.REVOKED)
      throw new BadRequestException("Exceção já revogada");

    await this.atomic(async (tx) => {
      await tx.closureReconciliationException.update({
        where: { id: exceptionId },
        data: {
          status: ClosureExceptionStatus.REVOKED,
          revokedAt: new Date(),
          revokedById: actorId,
          revokeReason: d.reason,
        },
      });
      if (exception.itemId) {
        await tx.closureReconciliationItem.update({
          where: { id: exception.itemId },
          data: { status: ClosureItemStatus.PENDING },
        });
      }
    });

    await this.hist(
      id,
      ClosureHistoryAction.EXCEPTION_REVOKED,
      actorId,
      `Exceção revogada: ${d.reason}`,
    );
    await this.syncMetrics(id);
    return this.get(id);
  }

  private async signoffWithin(id: string, d: SignoffDto, actorId: string) {
    const row = await this.current(id, d.expectedUpdatedAt);
    this.assertEditable(row.status);
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, status: UserStatus.ACTIVE },
      select: { name: true },
    });
    if (!user) throw new BadRequestException("Usuário ativo não encontrado");

    await this.prisma.closureReconciliationSignoff.upsert({
      where: {
        reconciliationId_role_userId: {
          reconciliationId: id,
          role: d.role,
          userId: actorId,
        },
      },
      create: {
        reconciliationId: id,
        role: d.role,
        userId: actorId,
        userNameSnapshot: user.name,
        statement: d.statement,
      },
      update: { statement: d.statement, signedAt: new Date() },
    });

    await this.hist(
      id,
      ClosureHistoryAction.SIGNOFF_ADDED,
      actorId,
      `Assinatura registrada como ${d.role}`,
    );
    await this.syncMetrics(id);
    return this.get(id);
  }

  private async removeSignoffWithin(
    id: string,
    signoffId: string,
    expectedUpdatedAt: string,
    actorId: string,
  ) {
    const row = await this.current(id, expectedUpdatedAt);
    if (row.status !== Status.DRAFT && row.status !== Status.COLLECTING)
      throw new BadRequestException(
        "Assinatura só pode ser removida antes da submissão",
      );
    const result = await this.prisma.closureReconciliationSignoff.deleteMany({
      where: { id: signoffId, reconciliationId: id },
    });
    if (!result.count) throw new NotFoundException("Assinatura não encontrada");
    await this.hist(
      id,
      ClosureHistoryAction.SIGNOFF_REMOVED,
      actorId,
      "Assinatura removida",
    );
    await this.syncMetrics(id);
    return this.get(id);
  }

  private async submitWithin(id: string, d: SubmitClosureDto, actorId: string) {
    const row = await this.current(id, d.expectedUpdatedAt);
    if (row.status !== Status.COLLECTING)
      throw new BadRequestException(
        `Transição ${row.status} -> IN_REVIEW inválida`,
      );
    const evaluation = this.tags(row, { allowOpenExceptions: true });
    if (!evaluation.readyToClose)
      throw new BadRequestException(
        `Conciliação não está pronta: ${evaluation.blockers.join(" ")}`,
      );

    const next =
      evaluation.openExceptions > 0
        ? Status.PENDING_EXCEPTIONS
        : Status.IN_REVIEW;
    await this.prisma.closureReconciliation.update({
      where: { id },
      data: {
        status: next,
        submittedAt: new Date(),
        submittedById: actorId,
      },
    });
    await this.hist(
      id,
      ClosureHistoryAction.SUBMITTED,
      actorId,
      next === Status.PENDING_EXCEPTIONS
        ? "Conciliação submetida com exceções aguardando aprovação"
        : "Conciliação submetida para revisão",
      row.status,
      next,
    );
    await this.emit("closure_reconciliation.submitted", row, actorId, {
      blockingItems: evaluation.blockingItems,
      readinessScore: evaluation.readinessScore,
    });
    return this.get(id);
  }

  private async approveWithin(
    id: string,
    expectedUpdatedAt: string,
    actorId: string,
    note?: string,
  ) {
    const row = await this.current(id, expectedUpdatedAt);
    if (row.status !== Status.IN_REVIEW)
      throw new BadRequestException(
        "Somente conciliação em revisão pode ser aprovada",
      );
    if (row.submittedById === actorId)
      throw new BadRequestException(
        "Aprovação exige usuário diferente de quem submeteu",
      );
    const evaluation = this.tags(row);
    if (!evaluation.readyToClose)
      throw new BadRequestException(
        `Conciliação não está pronta: ${evaluation.blockers.join(" ")}`,
      );

    await this.prisma.closureReconciliation.update({
      where: { id },
      data: {
        status: Status.READY,
        approvedAt: new Date(),
        approvedById: actorId,
        readinessScore: evaluation.readinessScore,
      },
    });
    await this.hist(
      id,
      ClosureHistoryAction.APPROVED,
      actorId,
      note ? `Conciliação aprovada — ${note}` : "Conciliação aprovada",
      row.status,
      Status.READY,
    );
    await this.emit("closure_reconciliation.approved", row, actorId, {
      readinessScore: evaluation.readinessScore,
    });
    return this.get(id);
  }

  private async closeWithin(id: string, d: CloseClosureDto, actorId: string) {
    const row = await this.current(id, d.expectedUpdatedAt);
    if (row.status !== Status.READY)
      throw new BadRequestException(
        "Somente conciliação pronta pode encerrar o pleito",
      );
    const evaluation = this.tags(row);
    if (!evaluation.readyToClose)
      throw new BadRequestException(
        `Conciliação não está pronta: ${evaluation.blockers.join(" ")}`,
      );
    const accepted = row.exceptions.filter(
      (exception) => exception.status === ClosureExceptionStatus.ACCEPTED,
    );
    if (accepted.some((exception) => exception.approvedById === actorId))
      throw new BadRequestException(
        "Encerramento exige usuário diferente de quem aprovou a exceção",
      );

    await this.prisma.closureReconciliation.update({
      where: { id },
      data: {
        status: Status.CLOSED,
        closureReason: d.closureReason,
        closedAt: new Date(),
        closedById: actorId,
      },
    });
    await this.hist(
      id,
      ClosureHistoryAction.CLOSED,
      actorId,
      "Encerramento operacional concluído",
      row.status,
      Status.CLOSED,
      {
        closureReason: d.closureReason,
        exceptionsAccepted: evaluation.acceptedExceptions,
      },
    );
    await this.emit("closure_reconciliation.closed", row, actorId, {
      readinessScore: evaluation.readinessScore,
      exceptionsAccepted: evaluation.acceptedExceptions,
    });
    return this.get(id);
  }

  private async reopenWithin(id: string, d: ReopenClosureDto, actorId: string) {
    const row = await this.current(id, d.expectedUpdatedAt);
    const reopenable: readonly Status[] = [
      Status.READY,
      Status.CLOSED,
      Status.IN_REVIEW,
      Status.PENDING_EXCEPTIONS,
    ];
    if (!reopenable.includes(row.status))
      throw new BadRequestException(
        `Transição ${row.status} -> COLLECTING inválida`,
      );
    if (row.status === Status.CLOSED) {
      const active = await this.prisma.closureReconciliation.findFirst({
        where: {
          id: { not: id }, electionId: row.electionId, electoralZoneId: row.electoralZoneId,
          status: { notIn: [Status.CLOSED, Status.CANCELLED] },
        },
        select: { id: true },
      });
      if (active) throw new ConflictException("Já existe conciliação ativa para este pleito e escopo");
    }
    await this.prisma.closureReconciliation.update({
      where: { id },
      data: {
        status: Status.COLLECTING,
        submittedAt: null,
        approvedAt: null,
        closedAt: null,
      },
    });
    await this.hist(
      id,
      ClosureHistoryAction.REOPENED,
      actorId,
      `Conciliação reaberta: ${d.reason}`,
      row.status,
      Status.COLLECTING,
    );
    await this.emit("closure_reconciliation.reopened", row, actorId, {
      reason: d.reason,
    });
    return this.get(id);
  }

  private async cancelWithin(id: string, d: CancelClosureDto, actorId: string) {
    const row = await this.current(id, d.expectedUpdatedAt);
    if (row.status === Status.CLOSED || row.status === Status.CANCELLED)
      throw new BadRequestException(
        `Transição ${row.status} -> CANCELLED inválida`,
      );
    await this.prisma.closureReconciliation.update({
      where: { id },
      data: { status: Status.CANCELLED, cancelledAt: new Date() },
    });
    await this.hist(
      id,
      ClosureHistoryAction.CANCELLED,
      actorId,
      `Conciliação cancelada: ${d.reason}`,
      row.status,
      Status.CANCELLED,
    );
    return this.get(id);
  }

  // -------------------------------------------------------------------------
  // Detecção
  // -------------------------------------------------------------------------

  private scopeWhere(scope: Scope) {
    if (scope.electoralZoneId) {
      return {
        OR: [
          { electoralZoneId: scope.electoralZoneId },
          { pollingPlace: { electoralZoneId: scope.electoralZoneId } },
        ],
      };
    }
    return {
      OR: [
        { electoralZone: { is: { electionId: scope.electionId } } },
        {
          pollingPlace: {
            is: { electoralZone: { is: { electionId: scope.electionId } } },
          },
        },
      ],
    };
  }

  private async detectAssets(
    scope: Scope,
    now: Date,
  ): Promise<DetectedItem[]> {
    const rows = await this.prisma.assetAssignment.findMany({
      where: {
        endedAt: null,
        returnedAt: null,
        ...this.scopeWhere(scope),
      },
      select: {
        id: true,
        purpose: true,
        assignedToName: true,
        destinationLabel: true,
        expectedReturnAt: true,
        assignedAt: true,
        asset: {
          select: { id: true, assetTag: true, name: true, status: true },
        },
        pollingPlace: { select: { name: true } },
        electoralZone: { select: { number: true } },
      },
      orderBy: { assignedAt: "asc" },
    });

    return rows.map((row) => {
      const lost = row.asset.status === AssetStatus.LOST;
      const base = lost
        ? ClosureSeverity.CRITICAL
        : ClosureSeverity.MEDIUM;
      const severity = escalateSeverity(base, row.expectedReturnAt, now);
      const destination =
        row.destinationLabel ??
        row.pollingPlace?.name ??
        (row.electoralZone ? `Zona ${row.electoralZone.number}` : "sem destino");
      return {
        category: ClosureItemCategory.ASSET_RETURN,
        sourceType: "ASSET_ASSIGNMENT",
        sourceId: row.id,
        referenceLabel: [row.asset.assetTag, row.asset.name, destination, row.assignedToName].filter(Boolean).join(" · "),
        title: `Ativo não devolvido: ${row.asset.name}`,
        detail: [
          `Destino: ${destination}`,
          row.assignedToName ? `Responsável: ${row.assignedToName}` : undefined,
          row.purpose ? `Finalidade: ${row.purpose}` : undefined,
          row.expectedReturnAt
            ? `Devolução prevista: ${row.expectedReturnAt.toISOString()}`
            : "Sem prazo de devolução registrado",
          `Estado do ativo: ${row.asset.status}`,
        ]
          .filter(Boolean)
          .join(" · "),
        severity,
        blocking: true,
        dueAt: row.expectedReturnAt,
        payload: {
          assetId: row.asset.id,
          assetStatus: row.asset.status,
          assignmentId: row.id,
        },
      } satisfies DetectedItem;
    });
  }

  private async detectDeliveries(scope: Scope): Promise<DetectedItem[]> {
    const rows = await this.prisma.delivery.findMany({
      where: {
        status: { in: [...PENDING_DELIVERY] },
        route: {
          electionId: scope.electionId,
          electoralZoneId: scope.electoralZoneId ?? undefined,
        },
      },
      select: {
        id: true,
        status: true,
        failureReason: true,
        receiverName: true,
        createdAt: true,
        route: { select: { code: true, name: true } },
        pollingPlace: {
          select: {
            name: true,
            electoralZone: { select: { number: true } },
          },
        },
        items: {
          select: { description: true, quantity: true },
          take: 5,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => {
      const severity =
        row.status === DeliveryStatus.FAILED
          ? ClosureSeverity.HIGH
          : ClosureSeverity.MEDIUM;
      const items = row.items
        .map((item) => `${item.quantity}x ${item.description}`)
        .join(", ");
      return {
        category: ClosureItemCategory.DELIVERY,
        sourceType: "DELIVERY",
        sourceId: row.id,
        referenceLabel: `${row.route.code} · ${row.pollingPlace.name}`,
        title: `Entrega pendente: ${row.pollingPlace.name}`,
        detail: [
          `Rota: ${row.route.code} — ${row.route.name}`,
          `Estado: ${row.status}`,
          `Zona: ${row.pollingPlace.electoralZone.number}`,
          items ? `Itens: ${items}` : undefined,
          row.failureReason ? `Falha: ${row.failureReason}` : undefined,
          row.receiverName ? `Recebedor: ${row.receiverName}` : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        severity,
        blocking: true,
        dueAt: row.createdAt,
        payload: {
          deliveryId: row.id,
          routeCode: row.route.code,
          status: row.status,
        },
      } satisfies DetectedItem;
    });
  }

  private async detectDispatches(
    scope: Scope,
  ): Promise<DetectedItem[]> {
    const rows = await this.prisma.fieldDispatch.findMany({
      where: {
        status: { in: [...OPEN_DISPATCH] },
        team: { electionId: scope.electionId },
        ...(scope.electoralZoneId
          ? { electoralZoneId: scope.electoralZoneId }
          : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        locationLabel: true,
        requestedAt: true,
        team: { select: { id: true, name: true, code: true } },
        member: { select: { name: true } },
        pollingPlace: { select: { name: true } },
        electoralZone: { select: { number: true } },
      },
      orderBy: { requestedAt: "asc" },
    });

    return rows.map((row) => {
      const inField =
        row.status === FieldDispatchStatus.IN_PROGRESS ||
        row.status === FieldDispatchStatus.ARRIVED;
      const severity = inField
        ? ClosureSeverity.HIGH
        : ClosureSeverity.MEDIUM;
      const location =
        row.locationLabel ??
        row.pollingPlace?.name ??
        (row.electoralZone ? `Zona ${row.electoralZone.number}` : "não informado");
      return {
        category: ClosureItemCategory.DISPATCH,
        sourceType: "FIELD_DISPATCH",
        sourceId: row.id,
        referenceLabel: `${row.team.code} · ${location}`,
        title: `Despacho aberto: ${row.title}`,
        detail: [
          `Equipe: ${row.team.name}`,
          `Estado: ${row.status}`,
          `Prioridade: ${row.priority}`,
          row.member ? `Responsável: ${row.member.name}` : undefined,
          `Solicitado em: ${row.requestedAt.toISOString()}`,
        ]
          .filter(Boolean)
          .join(" · "),
        severity,
        blocking: true,
        dueAt: row.requestedAt,
        payload: {
          dispatchId: row.id,
          teamId: row.team.id,
          status: row.status,
          priority: row.priority,
        },
      } satisfies DetectedItem;
    });
  }

  private async detectEvidence(scope: Scope): Promise<DetectedItem[]> {
    const delivered = await this.prisma.delivery.findMany({
      where: {
        status: DeliveryStatus.DELIVERED,
        proofUrl: null,
        route: {
          electionId: scope.electionId,
          electoralZoneId: scope.electoralZoneId ?? undefined,
        },
      },
      select: {
        id: true,
        deliveredAt: true,
        receiverName: true,
        route: { select: { code: true } },
        pollingPlace: { select: { name: true } },
      },
      orderBy: { deliveredAt: "asc" },
    });
    const linkedDeliveries = delivered.length
      ? await this.prisma.evidenceLink.findMany({
          where: {
            type: EvidenceLinkType.DELIVERY,
            targetId: { in: delivered.map((row) => row.id) },
          },
          select: { targetId: true },
        })
      : [];
    const linkedDeliveryIds = new Set(
      linkedDeliveries.map((row) => row.targetId),
    );

    const problematic = await this.prisma.assetAssignment.findMany({
      where: {
        problemDetected: true,
        endedAt: { not: null },
        ...this.scopeWhere(scope),
      },
      select: {
        id: true,
        assetId: true,
        endedAt: true,
        returnNotes: true,
        asset: { select: { assetTag: true, name: true } },
      },
      orderBy: { endedAt: "desc" },
    });
    const assetIds = [...new Set(problematic.map((row) => row.assetId))];
    const linkedAssets = assetIds.length
      ? await this.prisma.evidenceLink.findMany({
          where: {
            type: EvidenceLinkType.ASSET,
            targetId: { in: assetIds },
          },
          select: { targetId: true },
        })
      : [];
    const linkedAssetIds = new Set(linkedAssets.map((row) => row.targetId));

    const fromDeliveries: DetectedItem[] = delivered
      .filter((row) => !linkedDeliveryIds.has(row.id))
      .map((row) => ({
        category: ClosureItemCategory.EVIDENCE,
        sourceType: "DELIVERY_EVIDENCE",
        sourceId: row.id,
        referenceLabel: `${row.route.code} · ${row.pollingPlace.name}`,
        title: `Comprovante ausente: ${row.pollingPlace.name}`,
        detail: [
          "Entrega concluída sem URL de comprovante e sem evidência vinculada.",
          row.receiverName ? `Recebedor: ${row.receiverName}` : undefined,
          row.deliveredAt
            ? `Entregue em: ${row.deliveredAt.toISOString()}`
            : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        severity: ClosureSeverity.MEDIUM,
        blocking: false,
        dueAt: row.deliveredAt,
        payload: { deliveryId: row.id, evidenceType: "DELIVERY" },
      }));

    const seenAssets = new Set<string>();
    const fromAssets: DetectedItem[] = problematic
      .filter((row) => {
        if (linkedAssetIds.has(row.assetId) || seenAssets.has(row.assetId))
          return false;
        seenAssets.add(row.assetId);
        return true;
      })
      .map((row) => ({
        category: ClosureItemCategory.EVIDENCE,
        sourceType: "ASSET_EVIDENCE",
        sourceId: row.assetId,
        referenceLabel: `${row.asset.assetTag} · ${row.asset.name}`,
        title: `Evidência de devolução com problema: ${row.asset.name}`,
        detail: [
          "Devolução registrada com problema sem evidência do ativo vinculada.",
          row.returnNotes ? `Observação: ${row.returnNotes}` : undefined,
          row.endedAt ? `Encerrada em: ${row.endedAt.toISOString()}` : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        severity: ClosureSeverity.MEDIUM,
        blocking: false,
        dueAt: row.endedAt,
        payload: { assetId: row.assetId, evidenceType: "ASSET" },
      }));

    return [...fromDeliveries, ...fromAssets];
  }

  private async syncItems(
    reconciliationId: string,
    current: Array<{
      id: string;
      category: ClosureItemCategory;
      sourceType: string;
      sourceId: string;
      status: ClosureItemStatus;
    }>,
    detected: DetectedItem[],
    now: Date,
  ) {
    const key = (row: {
      category: ClosureItemCategory;
      sourceType: string;
      sourceId: string;
    }) => `${row.category}|${row.sourceType}|${row.sourceId}`;
    const existing = new Map(current.map((row) => [key(row), row]));
    const seen = new Set<string>();
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let created = 0;
    let updated = 0;
    let reopened = 0;

    for (const item of detected) {
      const identifier = key(item);
      seen.add(identifier);
      const previous = existing.get(identifier);
      if (!previous) {
        created += 1;
        ops.push(
          this.prisma.closureReconciliationItem.create({
            data: {
              reconciliationId,
              category: item.category,
              sourceType: item.sourceType,
              sourceId: item.sourceId,
              referenceLabel: item.referenceLabel,
              title: item.title,
              detail: item.detail,
              severity: item.severity,
              blocking: item.blocking,
              dueAt: item.dueAt ?? null,
              lastSeenAt: now,
              payload: item.payload,
            },
          }),
        );
        continue;
      }
      updated += 1;
      if (previous.status === ClosureItemStatus.RESOLVED) {
        reopened += 1;
        ops.push(this.prisma.closureReconciliationHistory.create({
          data: {
            reconciliationId, action: ClosureHistoryAction.ITEM_REOPENED,
            actorId: null, summary: `Pendência detectada novamente: ${item.referenceLabel}`,
            payload: { itemId: previous.id },
          },
        }));
        ops.push(
          this.prisma.closureReconciliationItem.update({
            where: { id: previous.id },
            data: {
              referenceLabel: item.referenceLabel,
              title: item.title,
              detail: item.detail,
              severity: item.severity,
              blocking: item.blocking,
              dueAt: item.dueAt ?? null,
              lastSeenAt: now,
              payload: item.payload,
              status: ClosureItemStatus.PENDING,
              resolvedAt: null,
              resolvedById: null,
              resolutionNote: null,
            },
          }),
        );
        continue;
      }
      ops.push(
        this.prisma.closureReconciliationItem.update({
          where: { id: previous.id },
          data: {
            referenceLabel: item.referenceLabel,
            title: item.title,
            detail: item.detail,
            severity: item.severity,
            blocking: item.blocking,
            dueAt: item.dueAt ?? null,
            lastSeenAt: now,
            payload: item.payload,
          },
        }),
      );
    }

    const stale = current.filter(
      (row) =>
        !seen.has(key(row)) && row.status === ClosureItemStatus.PENDING,
    );
    if (stale.length) {
      for (const item of stale) {
        ops.push(this.prisma.closureReconciliationHistory.create({
          data: {
            reconciliationId, action: ClosureHistoryAction.ITEM_RESOLVED,
            actorId: null, summary: `Origem não está mais pendente: ${item.sourceType} ${item.sourceId}`,
            payload: { itemId: item.id },
          },
        }));
      }
      ops.push(
        this.prisma.closureReconciliationItem.updateMany({
          where: { id: { in: stale.map((row) => row.id) } },
          data: {
            status: ClosureItemStatus.RESOLVED,
            resolvedAt: now,
            resolvedById: null,
            resolutionNote:
              "Origem não está mais pendente na detecção automática.",
          },
        }),
      );
    }

    if (ops.length) {
      if (this.transactional) await Promise.all(ops);
      else await this.prisma.$transaction(ops);
    }

    return {
      detected: detected.length,
      created,
      updated,
      autoResolved: stale.length,
      reopened,
    };
  }

  private async syncMetrics(
    id: string,
    now: Date = new Date(),
  ): Promise<ClosureEvaluationResult> {
    const [row, items, exceptions, signoffs] = await Promise.all([
      this.prisma.closureReconciliation.findUnique({
        where: { id },
        select: { lastRefreshedAt: true, status: true },
      }),
      this.prisma.closureReconciliationItem.findMany({
        where: { reconciliationId: id },
      }),
      this.prisma.closureReconciliationException.findMany({
        where: { reconciliationId: id },
      }),
      this.prisma.closureReconciliationSignoff.findMany({
        where: { reconciliationId: id },
      }),
    ]);

    const evaluation = evaluateClosure({
      items,
      exceptions,
      signoffs,
      lastRefreshedAt: row?.lastRefreshedAt ?? null,
      now,
    });
    const counter = (category: ClosureItemCategory) =>
      items.filter(
        (item) =>
          item.category === category &&
          !TREATED_ITEM_STATUSES.includes(item.status),
      ).length;

    const nextStatus = row?.status === Status.PENDING_EXCEPTIONS && evaluation.openExceptions === 0
      ? Status.IN_REVIEW
      : row?.status === Status.IN_REVIEW && evaluation.openExceptions > 0
        ? Status.PENDING_EXCEPTIONS : undefined;

    await this.prisma.closureReconciliation.update({
      where: { id },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        assetsUnreturned: counter(ClosureItemCategory.ASSET_RETURN),
        deliveriesPending: counter(ClosureItemCategory.DELIVERY),
        dispatchesOpen: counter(ClosureItemCategory.DISPATCH),
        evidenceMissing: counter(ClosureItemCategory.EVIDENCE),
        blockingItems: evaluation.blockingItems,
        readinessScore: evaluation.readinessScore,
        exceptionsOpen: evaluation.openExceptions,
        exceptionsAccepted: evaluation.acceptedExceptions,
        exceptionsExpired: evaluation.expiredExceptions,
      },
    });
    if (nextStatus) await this.hist(id, ClosureHistoryAction.UPDATED, null,
      nextStatus === Status.IN_REVIEW ? "Todas as exceções registradas foram decididas; conciliação retorna à revisão" : "Conciliação aguarda decisão de exceções",
      row?.status, nextStatus);
    return evaluation;
  }

  // -------------------------------------------------------------------------
  // Infraestrutura interna
  // -------------------------------------------------------------------------

  private async current(id: string, expected: string) {
    const row = await this.prisma.closureReconciliation.findUnique({
      where: { id },
      include,
    });
    if (!row) throw new NotFoundException("Conciliação não encontrada");
    if (!this.transactional && row.updatedAt.toISOString() !== new Date(expected).toISOString())
      throw new ConflictException(
        "Conciliação alterada por outro usuário; recarregue antes de continuar",
      );
    return row;
  }

  private async item(reconciliationId: string, itemId: string) {
    const item = await this.prisma.closureReconciliationItem.findFirst({
      where: { id: itemId, reconciliationId },
    });
    if (!item) throw new NotFoundException("Item não encontrado");
    return item;
  }

  private assertEditable(status: Status) {
    if (!EDITED_STATUSES.includes(status))
      throw new BadRequestException(
        "Conciliação pronta, encerrada ou cancelada não aceita alterações; reabra quando permitido",
      );
  }

  private hist(
    id: string,
    action: ClosureHistoryAction,
    actorId: string | null,
    summary: string,
    from?: Status,
    to?: Status,
    payload?: Prisma.InputJsonValue,
  ) {
    return this.prisma.closureReconciliationHistory.create({
      data: {
        reconciliationId: id,
        action,
        actorId,
        summary,
        fromStatus: from,
        toStatus: to,
        payload,
      },
    });
  }

  private async emit(
    name: DomainEventName,
    row: { id: string; electionId: string },
    actorId: string,
    extra: Record<string, unknown> = {},
  ) {
    if (this.transactional) {
      this.pendingEvents.push(async () => {
        await this.bus.emit(name, { entityId: row.id, actorId, reconciliationId: row.id, electionId: row.electionId, ...extra } as never);
      });
      return;
    }
    await this.bus.emit(name, {
      entityId: row.id,
      actorId,
      reconciliationId: row.id,
      electionId: row.electionId,
      ...extra,
    } as never);
  }
}
