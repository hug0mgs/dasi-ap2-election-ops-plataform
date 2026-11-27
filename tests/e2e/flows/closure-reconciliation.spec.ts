import { expect, test } from "@playwright/test";
import {
  API_BASE,
  apiGet,
  apiPost,
  currentUser,
  seed,
  tokenFor,
} from "../helpers/api";

const endpoint = "/closure-reconciliation";

interface ClosureItem {
  id: string;
  category: string;
  severity: string;
  blocking: boolean;
  status: string;
  title: string;
}

interface ClosureException {
  id: string;
  status: string;
  justification: string;
  risk: string;
}

interface ClosureSignoff {
  id: string;
  role: string;
  userId: string;
  userNameSnapshot: string;
}

interface ClosureDetail {
  id: string;
  code: string;
  status: string;
  readinessScore: number;
  blockingItems: number;
  assetsUnreturned: number;
  deliveriesPending: number;
  dispatchesOpen: number;
  evidenceMissing: number;
  exceptionsOpen: number;
  exceptionsAccepted: number;
  updatedAt: string;
  lastRefreshedAt: string | null;
  items: ClosureItem[];
  exceptions: ClosureException[];
  signoffs: ClosureSignoff[];
}

test("ciclo de vida completo da conciliação: abertura, detecção, exceções, assinaturas e encerramento", async ({
  request,
}) => {
  const { electionId, zoneId } = await seed(request);
  const admin = await currentUser(request, "admin");
  const supervisor = await currentUser(request, "supervisor");

  const viewerHeaders = {
    Authorization: `Bearer ${await tokenFor(request, "viewer")}`,
  };

  // 1. RBAC: acesso sem autenticação resulta em 401
  expect((await request.get(`${API_BASE}${endpoint}`)).status()).toBe(401);

  // 2. RBAC: perfil viewer não pode criar conciliação (403)
  expect(
    (
      await request.post(`${API_BASE}${endpoint}`, {
        headers: viewerHeaders,
        data: {
          electionId,
          electoralZoneId: zoneId,
          notes: "Abertura E2E de conciliação de teste",
        },
      })
    ).status(),
  ).toBe(403);

  // 3. Criação da conciliação pelo admin
  let closure = await apiPost<ClosureDetail>(request, "admin", endpoint, {
    electionId,
    electoralZoneId: zoneId,
    notes: "Conciliação E2E com escopo na zona",
  });

  expect(closure.id).toBeDefined();
  expect(closure.status).toBe("DRAFT");
  expect(closure.code).toMatch(/^ENC-\d{4}-\d+/);

  const path = `${endpoint}/${closure.id}`;
  const concurrency = () => ({ expectedUpdatedAt: closure.updatedAt });

  // 4. Detecção inicial (refresh) move DRAFT para COLLECTING
  closure = await apiPost<ClosureDetail>(
    request,
    "admin",
    `${path}/refresh`,
    concurrency(),
  );
  expect(closure.status).toBe("COLLECTING");
  expect(closure.lastRefreshedAt).not.toBeNull();

  // 5. Segunda detecção é idempotente
  const refreshed = await apiPost<ClosureDetail>(
    request,
    "admin",
    `${path}/refresh`,
    concurrency(),
  );
  expect(refreshed.status).toBe("COLLECTING");
  closure = refreshed;

  // 6. Submissão prematura é bloqueada se faltarem assinaturas mínimas
  const prematureSubmit = await request.post(`${API_BASE}${path}/submit`, {
    headers: { Authorization: `Bearer ${await tokenFor(request, "admin")}` },
    data: concurrency(),
  });
  expect(prematureSubmit.status()).toBe(400);

  // 7. Se houver pendências impeditivas, tratar ou justificar
  for (const it of closure.items) {
    if (it.blocking && it.status === "PENDING") {
      closure = await apiPost<ClosureDetail>(
        request,
        "admin",
        `${path}/items/${it.id}/resolve`,
        {
          ...concurrency(),
          resolutionNote: "Item resolvido via verificação de encerramento E2E",
        },
      );
    }
  }

  // 8. Registro de exceção com justificativa válida
  const exResponse = await apiPost<ClosureDetail>(
    request,
    "admin",
    `${path}/exceptions`,
    {
      ...concurrency(),
      category: "EVIDENCE",
      risk: "LOW",
      justification: "Exceção justificada com mais de vinte caracteres para teste E2E",
    },
  );
  closure = exResponse;
  const registeredEx = closure.exceptions.find((e) => e.status === "REGISTERED");
  expect(registeredEx).toBeDefined();

  // 9. Autoaprovação de exceção pelo mesmo usuário (admin) deve ser recusada (400)
  const selfApprove = await request.post(
    `${API_BASE}${path}/exceptions/${registeredEx!.id}/accept`,
    {
      headers: { Authorization: `Bearer ${await tokenFor(request, "admin")}` },
      data: concurrency(),
    },
  );
  expect(selfApprove.status()).toBe(400);

  // 10. Aprovação da exceção por usuário diferente (supervisor) é aceita
  closure = await apiPost<ClosureDetail>(
    request,
    "supervisor",
    `${path}/exceptions/${registeredEx!.id}/accept`,
    concurrency(),
  );
  const acceptedEx = closure.exceptions.find((e) => e.id === registeredEx!.id);
  expect(acceptedEx?.status).toBe("ACCEPTED");

  // 11. Registro de assinaturas mínimas exigidas (OPERATIONS_LEAD e LOGISTICS)
  closure = await apiPost<ClosureDetail>(
    request,
    "admin",
    `${path}/signoffs`,
    {
      ...concurrency(),
      role: "OPERATIONS_LEAD",
      statement: "Declaro que revisei os itens de operações desta conciliação",
    },
  );

  closure = await apiPost<ClosureDetail>(
    request,
    "supervisor",
    `${path}/signoffs`,
    {
      ...concurrency(),
      role: "LOGISTICS",
      statement: "Declaro que todos os ativos e entregas de logística foram auditados",
    },
  );

  expect(closure.signoffs.length).toBeGreaterThanOrEqual(2);

  // 12. Submissão da conciliação para revisão
  closure = await apiPost<ClosureDetail>(
    request,
    "admin",
    `${path}/submit`,
    concurrency(),
  );
  expect(closure.status).toBe("IN_REVIEW");

  // 13. Aprovação da conciliação para torná-la pronta para encerramento
  closure = await apiPost<ClosureDetail>(
    request,
    "supervisor",
    `${path}/approve`,
    concurrency(),
  );
  expect(closure.status).toBe("READY");

  // 14. Encerramento: supervisor aprovou a exceção no passo 10, logo o encerramento
  // deve ser feito por usuário distinto dos aprovadores das exceções (ex: admin)
  closure = await apiPost<ClosureDetail>(
    request,
    "admin",
    `${path}/close`,
    {
      ...concurrency(),
      closureReason: "Encerramento formal homologado após validação de todas as pendências operacionais",
    },
  );
  expect(closure.status).toBe("CLOSED");

  // 15. Consulta ao histórico auditável
  const history = await apiGet<Array<{ action: string; summary: string }>>(
    request,
    "admin",
    `${path}/history`,
  );
  expect(history.length).toBeGreaterThanOrEqual(5);
  expect(history.some((h) => h.action === "CREATED")).toBe(true);
  expect(history.some((h) => h.action === "REFRESHED")).toBe(true);
  expect(history.some((h) => h.action === "CLOSED")).toBe(true);
});
