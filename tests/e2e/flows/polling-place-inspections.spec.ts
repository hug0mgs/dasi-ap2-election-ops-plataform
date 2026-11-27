import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  API_BASE,
  apiGet,
  apiPost,
  apiPut,
  currentUser,
  seed,
  tokenFor,
} from "../helpers/api";

const endpoint = "/polling-place-inspections";

interface Inspection {
  id: string;
  updatedAt: string;
  status: string;
  fitness: string;
  responses: Array<{ id: string; answer: string }>;
  findings: Array<{
    id: string;
    status: string;
    blocking: boolean;
    resolution?: string;
  }>;
  evidenceLinks: Array<{ evidenceId: string; targetId: string }>;
  reviews: Array<{ decision: string; reviewerId: string }>;
  history: Array<{ action: string }>;
}

test("persiste a vistoria e exige revisão segregada sem impeditivos abertos", async ({
  request,
}) => {
  const { electionId, zoneId, placeId } = await seed(request);
  const executor = await currentUser(request, "admin");
  const reviewer = await currentUser(request, "supervisor");
  const catalog = await apiGet<Array<{ id: string; code: string }>>(
    request,
    "admin",
    `${endpoint}/catalog`,
  );
  const template = catalog.find(
    ({ code }) => code === "STANDARD_ACCESSIBILITY",
  );
  expect(template, "catálogo padrão semeado").toBeDefined();
  const creation = {
    electionId,
    electoralZoneId: zoneId,
    pollingPlaceId: placeId,
    templateId: template!.id,
    inspectionType: `E2E-${randomUUID()}`,
  };

  const viewerHeaders = {
    Authorization: `Bearer ${await tokenFor(request, "viewer")}`,
  };
  expect((await request.get(`${API_BASE}${endpoint}`)).status()).toBe(401);
  expect(
    (
      await request.post(`${API_BASE}${endpoint}`, {
        headers: viewerHeaders,
        data: creation,
      })
    ).status(),
  ).toBe(403);

  let inspection = await apiPost<Inspection>(
    request,
    "admin",
    endpoint,
    creation,
  );
  expect(inspection.status).toBe("DRAFT");
  const path = `${endpoint}/${inspection.id}`;
  const concurrency = () => ({ expectedUpdatedAt: inspection.updatedAt });
  const decision = () => ({ ...concurrency(), fitness: "FIT" });
  const approveDenied = async (
    role: "viewer" | "admin" | "supervisor",
    status: number,
    message?: string,
  ) => {
    const response = await request.post(`${API_BASE}${path}/approve`, {
      headers: { Authorization: `Bearer ${await tokenFor(request, role)}` },
      data: decision(),
    });
    expect(response.status()).toBe(status);
    if (message) expect((await response.json()).message).toContain(message);
  };

  inspection = await apiPost<Inspection>(
    request,
    "admin",
    `${path}/assignees`,
    {
      ...concurrency(),
      userId: executor.id,
      role: "LEAD",
    },
  );
  inspection = await apiPost<Inspection>(request, "admin", `${path}/schedule`, {
    ...concurrency(),
    plannedAt: new Date().toISOString(),
  });
  expect(inspection.status).toBe("SCHEDULED");
  expect(
    (
      await request.post(`${API_BASE}${path}/start`, {
        headers: viewerHeaders,
        data: concurrency(),
      })
    ).status(),
  ).toBe(403);
  inspection = await apiPost<Inspection>(
    request,
    "admin",
    `${path}/start`,
    concurrency(),
  );
  expect(inspection.status).toBe("IN_PROGRESS");
  expect(inspection.responses.length).toBeGreaterThan(0);
  for (const { id } of inspection.responses) {
    inspection = await apiPut<Inspection>(
      request,
      "admin",
      `${path}/responses/${id}`,
      {
        ...concurrency(),
        answer: "COMPLIANT",
      },
    );
  }

  inspection = await apiPost<Inspection>(request, "admin", `${path}/findings`, {
    ...concurrency(),
    title: "Acesso obstruído",
    description: "Obstrução na entrada principal",
    dimension: "ACCESS",
    severity: "CRITICAL",
  });
  expect(inspection.findings).toHaveLength(1);
  const [finding] = inspection.findings;
  expect(finding).toMatchObject({ blocking: true, status: "OPEN" });
  const evidenceId = randomUUID();
  inspection = await apiPut<Inspection>(
    request,
    "admin",
    `${path}/evidence-links`,
    {
      ...concurrency(),
      evidenceId,
      targetType: "FINDING",
      targetId: finding.id,
    },
  );
  inspection = await apiPost<Inspection>(
    request,
    "admin",
    `${path}/submit`,
    concurrency(),
  );
  expect(inspection.status).toBe("SUBMITTED");
  await approveDenied("supervisor", 400, "Pendência impeditiva aberta");

  inspection = await apiPost<Inspection>(
    request,
    "supervisor",
    `${path}/request-changes`,
    {
      ...concurrency(),
      reason: "Remover a obstrução antes da aprovação",
    },
  );
  expect(inspection.status).toBe("CHANGES_REQUESTED");
  inspection = await apiPost<Inspection>(
    request,
    "admin",
    `${path}/start`,
    concurrency(),
  );
  const resolution = "Obstrução removida da entrada principal";
  inspection = await apiPost<Inspection>(
    request,
    "admin",
    `${path}/findings/${finding.id}/resolve`,
    {
      ...concurrency(),
      resolution,
    },
  );
  inspection = await apiPost<Inspection>(
    request,
    "admin",
    `${path}/submit`,
    concurrency(),
  );
  await approveDenied("viewer", 403);
  await approveDenied("admin", 400, "Revisor deve ser diferente do executor");
  await apiPost<Inspection>(
    request,
    "supervisor",
    `${path}/approve`,
    decision(),
  );

  const persisted = await apiGet<Inspection>(request, "supervisor", path);
  expect(persisted).toMatchObject({ status: "APPROVED", fitness: "FIT" });
  expect(
    persisted.responses.every(({ answer }) => answer === "COMPLIANT"),
  ).toBe(true);
  expect(persisted.findings).toEqual([
    expect.objectContaining({ id: finding.id, status: "RESOLVED", resolution }),
  ]);
  expect(persisted.evidenceLinks).toEqual([
    expect.objectContaining({ evidenceId, targetId: finding.id }),
  ]);
  expect(persisted.reviews).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        decision: "APPROVED",
        reviewerId: reviewer.id,
      }),
      expect.objectContaining({
        decision: "CHANGES_REQUESTED",
        reviewerId: reviewer.id,
      }),
    ]),
  );
  expect(persisted.history.map(({ action }) => action)).toEqual(
    expect.arrayContaining([
      "STARTED",
      "FINDING_CREATED",
      "FINDING_RESOLVED",
      "CHANGES_REQUESTED",
      "APPROVED",
    ]),
  );
});
