import {
  ClosureExceptionStatus,
  ClosureItemStatus,
  ClosureSeverity,
  ClosureSignoffRole,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  MINIMUM_SIGNOFF_ROLES,
  SEVERITY_WEIGHT,
  computeReadiness,
  countBlocking,
  escalateSeverity,
  evaluateClosure,
  isExceptionExpired,
  itemPenalty,
  signoffGaps,
  signoffPenalty,
  totalWeight,
} from "./closure-rules";

const now = new Date("2026-11-18T12:00:00.000Z");

function item(
  overrides: Partial<{
    status: ClosureItemStatus;
    severity: ClosureSeverity;
    blocking: boolean;
  }> = {},
) {
  return {
    status: ClosureItemStatus.PENDING,
    severity: ClosureSeverity.MEDIUM,
    blocking: true,
    ...overrides,
  };
}

const allSignoffs = Object.values(ClosureSignoffRole).map((role) => ({ role }));

describe("closure-rules — pesos e penalidades", () => {
  it("define peso crescente por severidade", () => {
    expect(SEVERITY_WEIGHT[ClosureSeverity.LOW]).toBe(1);
    expect(SEVERITY_WEIGHT[ClosureSeverity.MEDIUM]).toBe(2);
    expect(SEVERITY_WEIGHT[ClosureSeverity.HIGH]).toBe(3);
    expect(SEVERITY_WEIGHT[ClosureSeverity.CRITICAL]).toBe(4);
  });

  it("não penaliza item resolvido nem dispensado", () => {
    expect(
      itemPenalty(item({ status: ClosureItemStatus.RESOLVED })),
    ).toBe(0);
    expect(
      itemPenalty(item({ status: ClosureItemStatus.DISMISSED })),
    ).toBe(0);
  });

  it("penaliza exceção com risco residual de 40%", () => {
    const penalty = itemPenalty(
      item({ status: ClosureItemStatus.EXCEPTION, severity: ClosureSeverity.HIGH }),
    );
    expect(penalty).toBeCloseTo(3 * 0.4);
    expect(
      itemPenalty(
        item({ status: ClosureItemStatus.ACCEPTED, severity: ClosureSeverity.CRITICAL }),
      ),
    ).toBeCloseTo(4 * 0.4);
  });

  it("penaliza pendência com peso integral", () => {
    expect(
      itemPenalty(item({ severity: ClosureSeverity.CRITICAL })),
    ).toBe(4);
  });

  it("soma peso total ignorando o estado", () => {
    expect(
      totalWeight([
        item({ severity: ClosureSeverity.LOW }),
        item({ severity: ClosureSeverity.HIGH, status: ClosureItemStatus.RESOLVED }),
      ]),
    ).toBe(4);
  });

  it("conta apenas pendência impeditiva", () => {
    expect(
      countBlocking([
        item(),
        item({ blocking: false }),
        item({ status: ClosureItemStatus.RESOLVED }),
        item({ status: ClosureItemStatus.EXCEPTION }),
      ]),
    ).toBe(1);
  });
});

describe("closure-rules — assinaturas", () => {
  it("exige liderança de operações e logística", () => {
    expect(MINIMUM_SIGNOFF_ROLES).toEqual([
      ClosureSignoffRole.OPERATIONS_LEAD,
      ClosureSignoffRole.LOGISTICS,
    ]);
  });

  it("lista lacunas obrigatórias na ordem mínima", () => {
    expect(
      signoffGaps([{ role: ClosureSignoffRole.OPERATIONS_LEAD }]),
    ).toEqual([ClosureSignoffRole.LOGISTICS]);
    expect(signoffGaps([])).toEqual([
      ClosureSignoffRole.OPERATIONS_LEAD,
      ClosureSignoffRole.LOGISTICS,
    ]);
    expect(signoffGaps(allSignoffs)).toEqual([]);
  });

  it("desconta 10 pontos por assinatura obrigatória e 5 por recomendada", () => {
    expect(signoffPenalty([])).toBe(30);
    expect(
      signoffPenalty([
        { role: ClosureSignoffRole.OPERATIONS_LEAD },
        { role: ClosureSignoffRole.LOGISTICS },
      ]),
    ).toBe(10);
    expect(signoffPenalty(allSignoffs)).toBe(0);
  });
});

describe("closure-rules — prontidão", () => {
  it("chega a 100 com tudo tratado e assinaturas completas", () => {
    expect(
      computeReadiness(
        [item({ status: ClosureItemStatus.RESOLVED })],
        allSignoffs,
      ),
    ).toBe(100);
  });

  it("reduz proporcionalmente à penalidade das pendências", () => {
    const score = computeReadiness(
      [
        item({ severity: ClosureSeverity.CRITICAL }),
        item({
          severity: ClosureSeverity.CRITICAL,
          status: ClosureItemStatus.RESOLVED,
        }),
      ],
      allSignoffs,
    );
    expect(score).toBe(50);
  });

  it("nunca fica negativo", () => {
    const score = computeReadiness(
      [
        item({ severity: ClosureSeverity.CRITICAL }),
        item({ severity: ClosureSeverity.CRITICAL }),
      ],
      [],
    );
    expect(score).toBe(0);
  });
});

describe("closure-rules — exceções", () => {
  it("considera vencida apenas exceção aprovada com validade no passado", () => {
    expect(
      isExceptionExpired(
        {
          status: ClosureExceptionStatus.ACCEPTED,
          validUntil: "2026-11-17T12:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(
      isExceptionExpired(
        {
          status: ClosureExceptionStatus.REGISTERED,
          validUntil: "2026-11-17T12:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isExceptionExpired(
        { status: ClosureExceptionStatus.ACCEPTED, validUntil: null },
        now,
      ),
    ).toBe(false);
  });
});

describe("closure-rules — avaliação de encerramento", () => {
  it("bloqueia sem detecção registrada", () => {
    const result = evaluateClosure({
      items: [],
      exceptions: [],
      signoffs: allSignoffs,
      lastRefreshedAt: null,
      now,
    });
    expect(result.readyToClose).toBe(false);
    expect(result.blockers[0]).toMatch(/Sem detecção registrada/);
  });

  it("bloqueia com pendência impeditiva, exceção aberta e lacuna de assinatura", () => {
    const result = evaluateClosure({
      items: [item({ severity: ClosureSeverity.HIGH })],
      exceptions: [
        { status: ClosureExceptionStatus.REGISTERED, validUntil: null },
      ],
      signoffs: [{ role: ClosureSignoffRole.AUDIT }],
      lastRefreshedAt: now,
      now,
    });
    expect(result.blockingItems).toBe(1);
    expect(result.openExceptions).toBe(1);
    expect(result.signoffGaps).toEqual([
      ClosureSignoffRole.OPERATIONS_LEAD,
      ClosureSignoffRole.LOGISTICS,
    ]);
    expect(result.readyToClose).toBe(false);
    expect(result.blockers).toHaveLength(3);
  });

  it("bloqueia com exceção aprovada vencida", () => {
    const result = evaluateClosure({
      items: [],
      exceptions: [
        {
          status: ClosureExceptionStatus.ACCEPTED,
          validUntil: "2026-11-01T12:00:00.000Z",
        },
      ],
      signoffs: allSignoffs,
      lastRefreshedAt: now,
      now,
    });
    expect(result.expiredExceptions).toBe(1);
    expect(result.readyToClose).toBe(false);
    expect(result.blockers.join(" ")).toMatch(/validade vencida/);
  });

  it("libera quando somente risco residual permanece", () => {
    const result = evaluateClosure({
      items: [
        item({ status: ClosureItemStatus.ACCEPTED, severity: ClosureSeverity.HIGH }),
      ],
      exceptions: [
        {
          status: ClosureExceptionStatus.ACCEPTED,
          validUntil: "2026-12-01T12:00:00.000Z",
        },
      ],
      signoffs: allSignoffs,
      lastRefreshedAt: now,
      now,
    });
    expect(result.readyToClose).toBe(true);
    expect(result.readinessScore).toBeGreaterThan(0);
    expect(result.blockers).toEqual([]);
  });
});

describe("closure-rules — escalonamento de severidade", () => {
  it("eleva para alta quando o prazo venceu", () => {
    expect(
      escalateSeverity(
        ClosureSeverity.MEDIUM,
        "2026-11-17T12:00:00.000Z",
        now,
      ),
    ).toBe(ClosureSeverity.HIGH);
  });

  it("preserva severidade quando o prazo está no futuro", () => {
    expect(
      escalateSeverity(
        ClosureSeverity.MEDIUM,
        "2026-11-25T12:00:00.000Z",
        now,
      ),
    ).toBe(ClosureSeverity.MEDIUM);
  });

  it("nunca rebaixa um item crítico", () => {
    expect(
      escalateSeverity(ClosureSeverity.CRITICAL, null, now),
    ).toBe(ClosureSeverity.CRITICAL);
  });
});
