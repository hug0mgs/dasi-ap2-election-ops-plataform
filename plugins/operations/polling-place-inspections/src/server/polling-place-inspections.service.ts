import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PollingPlaceInspectionAnswer as Answer,
  PollingPlaceInspectionFitness as Fitness,
  PollingPlaceInspectionFindingStatus as FindingStatus,
  PollingPlaceInspectionSeverity as Severity,
  PollingPlaceInspectionStatus as Status,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import type { DomainEventName } from "@eops/event-bus";
import type {
  AcceptRiskDto,
  ApproveDto,
  AssigneeDto,
  ConcurrencyDto,
  CreateInspectionDto,
  DecisionDto,
  EvidenceLinkDto,
  FindingDto,
  InspectionQueryDto,
  ResolveFindingDto,
  ResponseDto,
  ScheduleDto,
  UpdateFindingDto,
  UpdateInspectionDto,
} from "./dto/polling-place-inspections.dto";
const include = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true } },
  pollingPlace: { select: { id: true, name: true, address: true } },
  template: { select: { id: true, name: true, version: true } },
  responses: { orderBy: { sortOrder: "asc" as const } },
  assignees: {
    where: { active: true },
    orderBy: { assignedAt: "asc" as const },
  },
  findings: { orderBy: { dueAt: "asc" as const } },
  evidenceLinks: { where: { removedAt: null } },
  reviews: { orderBy: { createdAt: "desc" as const } },
  history: { orderBy: { createdAt: "desc" as const }, take: 100 },
} satisfies Prisma.PollingPlaceInspectionInclude;
const open: FindingStatus[] = [FindingStatus.OPEN, FindingStatus.IN_TREATMENT];
const nonCompliant: Answer[] = [
  Answer.PARTIALLY_COMPLIANT,
  Answer.NON_COMPLIANT,
];
@Injectable()
export class PollingPlaceInspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}
  private where(
    q: InspectionQueryDto,
  ): Prisma.PollingPlaceInspectionWhereInput {
    return {
      electionId: q.electionId,
      electoralZoneId: q.electoralZoneId,
      pollingPlaceId: q.pollingPlaceId,
      status: q.status,
      fitness: q.fitness,
      plannedAt:
        q.from || q.to
          ? {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            }
          : undefined,
      assignees: q.assigneeId
        ? { some: { userId: q.assigneeId, active: true } }
        : undefined,
      findings:
        q.problemDimension || q.openBlocking !== undefined
          ? {
              some: {
                dimension: q.problemDimension,
                blocking: q.openBlocking ? true : undefined,
                status: q.openBlocking ? { in: open } : undefined,
              },
            }
          : undefined,
    };
  }
  private derived<
    T extends {
      responses: { answer: Answer }[];
      findings: {
        blocking: boolean;
        status: FindingStatus;
        dimension: unknown;
      }[];
    },
  >(x: T) {
    const answered = x.responses.filter(
      (r) => r.answer !== Answer.NOT_VERIFIED,
    ).length;
    const blockers = x.findings.filter(
      (f) => f.blocking && open.includes(f.status),
    ).length;
    return {
      ...x,
      progress: x.responses.length
        ? Math.round((answered / x.responses.length) * 100)
        : 0,
      openBlockingFindings: blockers,
      criticalDimensions: [
        ...new Set(
          x.findings
            .filter((f) => open.includes(f.status))
            .map((f) => f.dimension),
        ),
      ],
    };
  }
  async references() {
    const [elections, zones, places, users] = await Promise.all([
      this.prisma.election.findMany({
        select: { id: true, name: true, year: true },
      }),
      this.prisma.electoralZone.findMany({
        select: { id: true, electionId: true, number: true, name: true },
      }),
      this.prisma.pollingPlace.findMany({
        select: { id: true, electoralZoneId: true, name: true, address: true },
      }),
      this.prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
        select: { id: true, name: true, email: true },
      }),
    ]);
    return { elections, zones, places, users };
  }
  catalog() {
    return this.prisma.pollingPlaceInspectionTemplate.findMany({
      where: { active: true },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
  }
  async list(q: InspectionQueryDto) {
    return (
      await this.prisma.pollingPlaceInspection.findMany({
        where: this.where(q),
        include,
        orderBy: { updatedAt: "desc" },
      })
    ).map((x) => this.derived(x));
  }
  async dashboard(q: InspectionQueryDto) {
    const rows = await this.list(q);
    return {
      total: rows.length,
      coverage: rows.length
        ? Math.round(
            (rows.filter((x) => x.status === Status.APPROVED).length /
              rows.length) *
              100,
          )
        : 0,
      byStatus: Object.fromEntries(
        Object.values(Status).map((s) => [
          s,
          rows.filter((x) => x.status === s).length,
        ]),
      ),
      unfit: rows.filter((x) => x.fitness === Fitness.UNFIT).length,
      openBlocking: rows.reduce((n, x) => n + x.openBlockingFindings, 0),
      criticalDimensions: Object.fromEntries(
        ["ACCESS", "ENERGY", "CONNECTIVITY", "SIGNAGE", "INFRASTRUCTURE"].map(
          (d) => [
            d,
            rows.filter((x) => x.criticalDimensions.includes(d as never))
              .length,
          ],
        ),
      ),
    };
  }
  async get(id: string) {
    const x = await this.prisma.pollingPlaceInspection.findUnique({
      where: { id },
      include,
    });
    if (!x) throw new NotFoundException("Vistoria não encontrada");
    return this.derived(x);
  }
  history(id: string) {
    return this.prisma.pollingPlaceInspectionHistory.findMany({
      where: { inspectionId: id },
      orderBy: { createdAt: "desc" },
    });
  }
  async create(d: CreateInspectionDto, actorId: string) {
    const [place, template, previous] = await Promise.all([
      this.prisma.pollingPlace.findFirst({
        where: {
          id: d.pollingPlaceId,
          electoralZoneId: d.electoralZoneId,
          electoralZone: { electionId: d.electionId },
        },
        select: { id: true },
      }),
      this.prisma.pollingPlaceInspectionTemplate.findFirst({
        where: { id: d.templateId, active: true },
        include: { items: true },
      }),
      d.previousInspectionId
        ? this.prisma.pollingPlaceInspection.findUnique({
            where: { id: d.previousInspectionId },
          })
        : null,
    ]);
    if (!place || !template)
      throw new BadRequestException("Local, pleito, zona ou catálogo inválido");
    const active = await this.prisma.pollingPlaceInspection.findFirst({
      where: {
        pollingPlaceId: d.pollingPlaceId,
        electionId: d.electionId,
        inspectionType: d.inspectionType,
        status: { not: Status.CANCELLED },
      },
    });
    if (active)
      throw new ConflictException("Já existe rodada ativa para o local");
    if (
      d.previousInspectionId &&
      (!previous || previous.status !== Status.APPROVED)
    )
      throw new BadRequestException(
        "Revisita exige vistoria anterior aprovada",
      );
    const round = previous ? previous.roundNumber + 1 : 1;
    let x;
    try {
      x = await this.prisma.$transaction(async (tx) => {
        const created = await tx.pollingPlaceInspection.create({
          data: {
            electionId: d.electionId,
            electoralZoneId: d.electoralZoneId,
            pollingPlaceId: d.pollingPlaceId,
            templateId: d.templateId,
            inspectionType: d.inspectionType,
            roundNumber: round,
            previousInspectionId: d.previousInspectionId,
            createdById: actorId,
            responses: {
              create: template.items.map((i) => ({
                templateItemId: i.id,
                itemCode: i.code,
                dimension: i.dimension,
                title: i.title,
                description: i.description,
                required: i.required,
                critical: i.critical,
                evidenceRequired: i.evidenceRequired,
                sortOrder: i.sortOrder,
              })),
            },
          },
        });
        await tx.pollingPlaceInspectionHistory.create({
          data: {
            inspectionId: created.id,
            action: "CREATED",
            actorId,
            summary: "Vistoria criada com snapshot do catálogo",
            toStatus: Status.DRAFT,
          },
        });
        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Já existe rodada ativa para o local");
      }
      throw error;
    }
    await this.emit("polling_place_inspection.created", x, actorId, {
      roundNumber: round,
    });
    return this.get(x.id);
  }
  async update(id: string, d: UpdateInspectionDto, actorId: string) {
    await this.current(id, d.expectedUpdatedAt);
    await this.prisma.pollingPlaceInspection.update({
      where: { id },
      data: { accessNotes: d.accessNotes, localContact: d.localContact },
    });
    await this.hist(id, "UPDATED", actorId, "Dados da vistoria atualizados");
    return this.get(id);
  }
  async assign(id: string, d: AssigneeDto, actorId: string) {
    await this.current(id, d.expectedUpdatedAt);
    const u = await this.prisma.user.findFirst({
      where: { id: d.userId, status: UserStatus.ACTIVE },
      select: { name: true },
    });
    if (!u) throw new BadRequestException("Responsável ativo não encontrado");
    await this.prisma.pollingPlaceInspectionAssignee.upsert({
      where: {
        inspectionId_userId_role: {
          inspectionId: id,
          userId: d.userId,
          role: d.role,
        },
      },
      create: {
        inspectionId: id,
        userId: d.userId,
        userNameSnapshot: u.name,
        role: d.role,
      },
      update: { active: true, removedAt: null, userNameSnapshot: u.name },
    });
    await this.hist(id, "ASSIGNEE_ADDED", actorId, "Responsável atribuído");
    return this.get(id);
  }
  async unassign(id: string, aid: string, d: ConcurrencyDto, actorId: string) {
    await this.current(id, d.expectedUpdatedAt);
    await this.prisma.pollingPlaceInspectionAssignee.updateMany({
      where: { id: aid, inspectionId: id, active: true },
      data: { active: false, removedAt: new Date() },
    });
    await this.hist(id, "ASSIGNEE_REMOVED", actorId, "Responsável removido");
    return this.get(id);
  }
  private async transition(
    id: string,
    d: ConcurrencyDto,
    actorId: string,
    from: Status[],
    to: Status,
    action: string,
    summary: string,
    data: Prisma.PollingPlaceInspectionUpdateInput = {},
  ) {
    const x = await this.current(id, d.expectedUpdatedAt);
    if (!from.includes(x.status))
      throw new BadRequestException(`Transição ${x.status} -> ${to} inválida`);
    const updated = await this.prisma.pollingPlaceInspection.update({
      where: { id },
      data: { ...data, status: to },
    });
    await this.hist(id, action, actorId, summary, x.status, to);
    return updated;
  }
  async schedule(id: string, d: ScheduleDto, a: string) {
    const x = await this.current(id, d.expectedUpdatedAt);
    if (!x.assignees.length)
      throw new BadRequestException("Agendamento exige responsável ativo");
    await this.transition(
      id,
      d,
      a,
      [Status.DRAFT],
      Status.SCHEDULED,
      "SCHEDULED",
      "Vistoria agendada",
      { plannedAt: new Date(d.plannedAt) },
    );
    await this.emit("polling_place_inspection.scheduled", x, a, {
      plannedAt: d.plannedAt,
    });
    return this.get(id);
  }
  async start(id: string, d: ConcurrencyDto, a: string) {
    const x = await this.transition(
      id,
      d,
      a,
      [Status.SCHEDULED, Status.CHANGES_REQUESTED, Status.REOPENED],
      Status.IN_PROGRESS,
      "STARTED",
      "Execução iniciada",
      { startedAt: new Date(), lastExecutorId: a },
    );
    await this.emit("polling_place_inspection.started", x, a);
    return this.get(id);
  }
  async response(id: string, rid: string, d: ResponseDto, a: string) {
    const x = await this.current(id, d.expectedUpdatedAt);
    if (x.status !== Status.IN_PROGRESS)
      throw new BadRequestException("Respostas exigem vistoria em execução");
    if (nonCompliant.includes(d.answer) && !d.observation)
      throw new BadRequestException("Resposta não conforme exige observação");
    if (d.answer === Answer.NOT_APPLICABLE && !d.justification)
      throw new BadRequestException("Não aplicável exige justificativa");
    const r = await this.prisma.pollingPlaceInspectionResponse.findFirst({
      where: { id: rid, inspectionId: id },
    });
    if (!r) throw new NotFoundException("Resposta não encontrada");
    await this.prisma.pollingPlaceInspectionResponse.update({
      where: { id: rid },
      data: {
        answer: d.answer,
        observation: d.observation,
        justification: d.justification,
        updatedById: a,
      },
    });
    if (r.critical && nonCompliant.includes(d.answer)) {
      const found = await this.prisma.pollingPlaceInspectionFinding.findFirst({
        where: { inspectionId: id, responseId: rid, status: { in: open } },
      });
      if (!found)
        await this.prisma.pollingPlaceInspectionFinding.create({
          data: {
            inspectionId: id,
            responseId: rid,
            title: r.title,
            description: d.observation!,
            dimension: r.dimension,
            severity: Severity.CRITICAL,
            blocking: true,
            blockingReason: "Item crítico não conforme",
          },
        });
    }
    await this.hist(id, "RESPONSE_UPDATED", a, "Resposta atualizada");
    return this.get(id);
  }

  async finding(id: string, d: FindingDto, a: string) {
    await this.current(id, d.expectedUpdatedAt);
    const blocking =
      d.severity === Severity.CRITICAL ? true : (d.blocking ?? false);
    if (blocking && !d.blockingReason && d.severity !== Severity.CRITICAL)
      throw new BadRequestException("Impedimento exige justificativa");
    const f = await this.prisma.pollingPlaceInspectionFinding.create({
      data: {
        inspectionId: id,
        responseId: d.responseId,
        title: d.title,
        description: d.description,
        dimension: d.dimension,
        severity: d.severity,
        location: d.location,
        recommendation: d.recommendation,
        responsibleId: d.responsibleId,
        responsibleName: d.responsibleName,
        dueAt: d.dueAt ? new Date(d.dueAt) : undefined,
        blocking,
        blockingReason:
          d.blockingReason ?? (blocking ? "Achado crítico" : undefined),
      },
    });
    await this.hist(id, "FINDING_CREATED", a, "Achado registrado");
    if (blocking)
      await this.emit(
        "polling_place_inspection.blocking_finding_created",
        await this.get(id),
        a,
        { findingId: f.id },
      );
    return this.get(id);
  }
  async updateFinding(id: string, fid: string, d: UpdateFindingDto, a: string) {
    await this.current(id, d.expectedUpdatedAt);
    await this.prisma.pollingPlaceInspectionFinding.updateMany({
      where: { id: fid, inspectionId: id },
      data: {
        status: d.status,
        recommendation: d.recommendation,
        responsibleId: d.responsibleId,
        dueAt: d.dueAt ? new Date(d.dueAt) : undefined,
      },
    });
    await this.hist(id, "FINDING_UPDATED", a, "Achado atualizado");
    return this.get(id);
  }
  async resolve(id: string, fid: string, d: ResolveFindingDto, a: string) {
    await this.current(id, d.expectedUpdatedAt);
    const f = await this.prisma.pollingPlaceInspectionFinding.findFirst({
      where: { id: fid, inspectionId: id },
    });
    if (!f) throw new NotFoundException("Achado não encontrado");
    await this.prisma.pollingPlaceInspectionFinding.update({
      where: { id: fid },
      data: {
        status: FindingStatus.RESOLVED,
        resolution: d.resolution,
        resolvedAt: new Date(),
        resolvedById: a,
      },
    });
    await this.hist(id, "FINDING_RESOLVED", a, "Achado resolvido");
    if (f.blocking)
      await this.emit(
        "polling_place_inspection.blocking_finding_resolved",
        await this.get(id),
        a,
        { findingId: fid },
      );
    return this.get(id);
  }
  async acceptRisk(id: string, fid: string, d: AcceptRiskDto, a: string) {
    await this.current(id, d.expectedUpdatedAt);
    await this.prisma.pollingPlaceInspectionFinding.updateMany({
      where: { id: fid, inspectionId: id },
      data: {
        status: FindingStatus.ACCEPTED,
        riskAcceptanceReason: d.reason,
        riskAcceptedById: a,
        riskAcceptanceValidUntil: new Date(d.validUntil),
      },
    });
    await this.hist(id, "RISK_ACCEPTED", a, "Risco formalmente aceito");
    return this.get(id);
  }
  async evidence(id: string, d: EvidenceLinkDto, a: string) {
    await this.current(id, d.expectedUpdatedAt);
    if (d.remove)
      await this.prisma.pollingPlaceInspectionEvidenceLink.updateMany({
        where: {
          inspectionId: id,
          evidenceId: d.evidenceId,
          targetType: d.targetType,
          targetId: d.targetId,
          removedAt: null,
        },
        data: { removedAt: new Date() },
      });
    else
      await this.prisma.pollingPlaceInspectionEvidenceLink.upsert({
        where: {
          inspectionId_evidenceId_targetType_targetId: {
            inspectionId: id,
            evidenceId: d.evidenceId,
            targetType: d.targetType,
            targetId: d.targetId,
          },
        },
        create: {
          inspectionId: id,
          evidenceId: d.evidenceId,
          targetType: d.targetType,
          targetId: d.targetId,
          linkedById: a,
        },
        update: { removedAt: null, linkedById: a, linkedAt: new Date() },
      });
    await this.hist(
      id,
      d.remove ? "EVIDENCE_UNLINKED" : "EVIDENCE_LINKED",
      a,
      d.remove ? "Evidência desvinculada" : "Evidência vinculada",
    );
    return this.get(id);
  }
  async submit(id: string, d: ConcurrencyDto, a: string) {
    const x = await this.current(id, d.expectedUpdatedAt);
    if (x.status !== Status.IN_PROGRESS)
      throw new BadRequestException(
        "Somente vistoria em execução pode ser submetida",
      );
    const missing = x.responses.filter(
      (r) =>
        (r.required && r.answer === Answer.NOT_VERIFIED) ||
        (r.answer === Answer.NOT_APPLICABLE && !r.justification),
    );
    const ev = x.responses.filter(
      (r) =>
        r.evidenceRequired &&
        nonCompliant.includes(r.answer) &&
        !x.evidenceLinks.some(
          (e) => e.targetType === "RESPONSE" && e.targetId === r.id,
        ),
    );
    if (missing.length || ev.length)
      throw new BadRequestException(
        "Itens obrigatórios, justificativas ou evidências pendentes",
      );
    const u = await this.transition(
      id,
      d,
      a,
      [Status.IN_PROGRESS],
      Status.SUBMITTED,
      "SUBMITTED",
      "Vistoria submetida",
      { submittedAt: new Date(), completedAt: new Date(), lastExecutorId: a },
    );
    await this.emit("polling_place_inspection.submitted", u, a);
    return this.get(id);
  }
  async approve(id: string, d: ApproveDto, a: string) {
    const x = await this.current(id, d.expectedUpdatedAt);
    if (x.status !== Status.SUBMITTED)
      throw new BadRequestException(
        "Somente vistoria submetida pode ser aprovada",
      );
    if (x.lastExecutorId === a)
      throw new BadRequestException("Revisor deve ser diferente do executor");
    if (d.fitness === Fitness.NOT_ASSESSED)
      throw new BadRequestException("Aptidão explícita obrigatória");
    if (x.findings.some((f) => f.blocking && open.includes(f.status)))
      throw new BadRequestException(
        "Pendência impeditiva aberta bloqueia aprovação",
      );
    if (
      d.fitness === Fitness.FIT &&
      x.findings.some((f) => open.includes(f.status))
    )
      throw new BadRequestException("FIT não permite pendência aberta");
    await this.prisma.$transaction([
      this.prisma.pollingPlaceInspection.update({
        where: { id },
        data: {
          status: Status.APPROVED,
          fitness: d.fitness,
          approvedAt: new Date(),
        },
      }),
      this.prisma.pollingPlaceInspectionReview.create({
        data: {
          inspectionId: id,
          reviewerId: a,
          decision: "APPROVED",
          fitness: d.fitness,
        },
      }),
      this.prisma.pollingPlaceInspectionHistory.create({
        data: {
          inspectionId: id,
          action: "APPROVED",
          actorId: a,
          summary: "Vistoria aprovada",
          fromStatus: x.status,
          toStatus: Status.APPROVED,
        },
      }),
    ]);
    await this.emit("polling_place_inspection.approved", x, a, {
      fitness: d.fitness,
    });
    if (x.fitness !== d.fitness)
      await this.emit("polling_place_inspection.fitness_changed", x, a, {
        from: x.fitness,
        to: d.fitness,
      });
    return this.get(id);
  }
  async requestChanges(id: string, d: DecisionDto, a: string) {
    const x = await this.transition(
      id,
      d,
      a,
      [Status.SUBMITTED],
      Status.CHANGES_REQUESTED,
      "CHANGES_REQUESTED",
      d.reason,
    );
    await this.prisma.pollingPlaceInspectionReview.create({
      data: {
        inspectionId: id,
        reviewerId: a,
        decision: "CHANGES_REQUESTED",
        reason: d.reason,
      },
    });
    await this.emit("polling_place_inspection.changes_requested", x, a, {
      reason: d.reason,
    });
    return this.get(id);
  }
  async reopen(id: string, d: DecisionDto, a: string) {
    const x = await this.transition(
      id,
      d,
      a,
      [Status.APPROVED],
      Status.REOPENED,
      "REOPENED",
      d.reason,
    );
    await this.emit("polling_place_inspection.reopened", x, a, {
      reason: d.reason,
    });
    return this.get(id);
  }
  async cancel(id: string, d: DecisionDto, a: string) {
    const x = await this.transition(
      id,
      d,
      a,
      [
        Status.DRAFT,
        Status.SCHEDULED,
        Status.IN_PROGRESS,
        Status.CHANGES_REQUESTED,
      ],
      Status.CANCELLED,
      "CANCELLED",
      d.reason,
    );
    await this.emit("polling_place_inspection.cancelled", x, a, {
      reason: d.reason,
    });
    return this.get(id);
  }

  private async current(id: string, expected: string) {
    const x = await this.prisma.pollingPlaceInspection.findUnique({
      where: { id },
      include,
    });
    if (!x) throw new NotFoundException("Vistoria não encontrada");
    if (x.updatedAt.toISOString() !== new Date(expected).toISOString())
      throw new ConflictException("Vistoria alterada por outro usuário");
    return x;
  }
  private hist(
    id: string,
    action: string,
    actorId: string,
    summary: string,
    from?: Status,
    to?: Status,
    payload?: Prisma.InputJsonValue,
  ) {
    return this.prisma.pollingPlaceInspectionHistory.create({
      data: {
        inspectionId: id,
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
    x: { id: string; electionId: string; pollingPlaceId: string },
    actorId: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.bus.emit(name, {
      entityId: x.id,
      actorId,
      inspectionId: x.id,
      electionId: x.electionId,
      pollingPlaceId: x.pollingPlaceId,
      ...extra,
    } as never);
  }
}
