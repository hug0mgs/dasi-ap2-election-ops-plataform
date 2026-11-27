import { randomUUID } from "node:crypto";
import { expect, test, type Page, type APIRequestContext, type Route } from "@playwright/test";
import { API_BASE, apiGet, apiPatch, apiPost, seed, statusOf, uniqueSuffix } from "./helpers/api";
import { loginAs } from "./helpers/ui";

interface Incident {
  id: string;
  title: string;
  events: Array<{ type: string }>;
}
interface Dispatch { id: string; status: string; updatedAt: string; events: Array<{ toStatus: string | null }> }
interface Checklist { id: string; items: Array<{ id: string; status: string; updatedAt: string; observation: string | null }> }
const queue = (page: Page) => page.getByRole("region", { name: "Fila de campo sem conexão" });

interface CapturedEntry { id: string; kind: string; body: Record<string, unknown>; state: string; attempts: number }
async function capturedEntries(page: Page): Promise<CapturedEntry[]> {
  return page.evaluate(() => Object.keys(localStorage)
    .filter((key) => key.startsWith("eops.offline.v1.entry."))
    .map((key) => JSON.parse(localStorage.getItem(key) ?? "null"))
    .filter((entry) => entry !== null));
}

async function incidentPayload(request: APIRequestContext) {
  const context = await seed(request);
  return {
    title: `Ocorrência offline ${uniqueSuffix()}`,
    description: "Falha de energia registrada pelo operador sem conexão.",
    severity: "HIGH",
    electionId: context.electionId,
    categoryId: context.incidentCategoryId,
    electoralZoneId: context.zoneId,
    pollingPlaceId: context.placeId,
  };
}

async function prepareIncident(page: Page, request: APIRequestContext) {
  const body = await incidentPayload(request);
  await page.goto("/incidents/new");
  await expect(page.getByRole("heading", { name: "Novo incidente" })).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill(body.title);
  await page.getByLabel("Descrição", { exact: true }).fill(body.description);
  await page.getByRole("combobox", { name: "Pleito", exact: true }).selectOption(body.electionId);
  await page.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(body.categoryId);
  return body;
}

async function createDispatch(request: APIRequestContext): Promise<Dispatch> {
  const context = await seed(request);
  const suffix = uniqueSuffix();
  const team = await apiPost<{ id: string }>(request, "admin", "/field-teams", {
    name: `Equipe offline ${suffix}`, code: `OFF-${suffix.toUpperCase()}`,
    electionId: context.electionId, responsibleName: "Coordenação offline E2E",
  });
  await apiPost(request, "admin", "/field-teams/members", {
    teamId: team.id, roleId: context.fieldRoleId, name: `Operador offline ${suffix}`,
  });
  const created = await apiPost<{ id: string }>(request, "admin", "/field-teams/dispatches", {
    teamId: team.id, title: `Conferência offline ${suffix}`, priority: "HIGH",
    electoralZoneId: context.zoneId, pollingPlaceId: context.placeId,
  });
  return apiGet<Dispatch>(request, "admin", `/field-teams/dispatches/${created.id}`);
}

async function createChecklist(request: APIRequestContext): Promise<Checklist> {
  const context = await seed(request);
  const template = await apiPost<{ id: string }>(request, "admin", "/preparation-checklists/templates", {
    name: `Modelo offline ${uniqueSuffix()}`, locationType: "POLLING_PLACE", active: true,
    items: [{ title: "Conferir iluminação", order: 1, required: true, evidenceRequired: false }],
  });
  return apiPost<Checklist>(request, "admin", "/preparation-checklists", {
    electionId: context.electionId, electoralZoneId: context.zoneId,
    pollingPlaceId: context.placeId, templateId: template.id,
  });
}

/**
 * A SPEC não promete inicialização integral offline. Depois da captura realmente
 * desconectada, a recarga ocorre com leituras/autenticação disponíveis e apenas
 * a mutação ainda indisponível. Assim comprovamos persistência sem simular cache.
 */
async function reloadPendingAndSynchronize(page: Page, path: RegExp, label: string) {
  await expect(queue(page).getByText(`${label} · Pendente`, { exact: true })).toBeVisible();
  const unavailable = (route: Route) => route.abort("connectionfailed");
  await page.route(path, unavailable);
  await page.context().setOffline(false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(queue(page).getByText(`${label} · Pendente`, { exact: true })).toBeVisible();
  await page.unroute(path, unavailable);
  const response = page.waitForResponse((result) => path.test(result.url()) && ["POST", "PATCH"].includes(result.request().method()) && result.ok());
  const synchronize = queue(page).getByRole("button", { name: "Sincronizar agora" });
  await expect(synchronize).toBeEnabled();
  await synchronize.click();
  const saved = await response;
  await expect(queue(page).getByText(`${label} · Sincronizada`, { exact: true })).toBeVisible();
  return saved;
}

async function logout(page: Page) {
  await page.getByRole("button", { name: /^Abrir menu de / }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
}

test.describe("operação de campo sem conexão", () => {
  test.use({ actionTimeout: 20_000 });
  test("captura incidente offline, preserva na recarga e sincroniza uma única criação", async ({ page, request }) => {
    await loginAs(page, "admin");
    const body = await prepareIncident(page, request);
    await page.context().setOffline(true);
    await page.getByRole("button", { name: /Guardar na fila local|Salvar incidente/ }).click();
    const saved = await reloadPendingAndSynchronize(page, /\/api\/incidents\/offline\//, "Ocorrência");
    const result = await saved.json() as Incident;
    const persisted = await apiGet<Incident>(request, "admin", `/incidents/${result.id}`);
    expect(persisted.title).toBe(body.title);
    expect(persisted.events.filter(({ type }) => type === "INCIDENT_CREATED")).toHaveLength(1);
  });

  test("captura transição de despacho existente e confirma o estado do servidor após reconectar", async ({ page, request }) => {
    const dispatch = await createDispatch(request);
    await loginAs(page, "admin");
    await page.goto(`/field-teams/dispatch/${dispatch.id}`);
    await expect(page.getByRole("combobox", { name: "Transição", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Transição", exact: true }).selectOption("DISPATCHED");
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Aplicar transição" }).click();
    expect((await apiGet<Dispatch>(request, "admin", `/field-teams/dispatches/${dispatch.id}`)).status).toBe("REQUESTED");
    await reloadPendingAndSynchronize(page, new RegExp(`/api/field-teams/dispatches/${dispatch.id}/status`), "Despacho");
    const persisted = await apiGet<Dispatch>(request, "admin", `/field-teams/dispatches/${dispatch.id}`);
    expect(persisted.status).toBe("DISPATCHED");
    expect(persisted.events.filter(({ toStatus }) => toStatus === "DISPATCHED")).toHaveLength(1);
    await expect(page.getByRole("combobox", { name: "Transição", exact: true }).locator('option[value="DISPATCHED"]')).toHaveCount(0);
  });

  test("captura item de checklist existente e reconsulta a conclusão após sincronização", async ({ page, request }) => {
    const checklist = await createChecklist(request);
    await loginAs(page, "admin");
    await page.goto(`/preparation-checklists/${checklist.id}`);
    const item = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Conferir iluminação" }) });
    await expect(item).toBeVisible();
    await item.getByRole("combobox", { name: "Status", exact: true }).selectOption("COMPLETED");
    await item.getByLabel("Observação", { exact: true }).fill("Iluminação conferida durante perda de conexão.");
    await page.context().setOffline(true);
    await item.getByRole("button", { name: "Salvar item" }).click();
    expect((await apiGet<Checklist>(request, "admin", `/preparation-checklists/${checklist.id}`)).items[0].status).toBe("PENDING");
    await reloadPendingAndSynchronize(page, new RegExp(`/api/preparation-checklists/items/${checklist.items[0].id}$`), "Item de checklist");
    const persisted = await apiGet<Checklist>(request, "admin", `/preparation-checklists/${checklist.id}`);
    expect(persisted.items[0]).toMatchObject({ status: "COMPLETED", observation: "Iluminação conferida durante perda de conexão." });
    await expect(item.getByText(/^Concluído em /)).toBeVisible();
  });

  test("reenvio concorrente não duplica incidente ou evento e rejeita payload/autor diferentes", async ({ request }) => {
    const operationId = randomUUID();
    const body = await incidentPayload(request);
    const path = `/incidents/offline/${operationId}`;
    const [first, replay] = await Promise.all([
      apiPost<Incident>(request, "admin", path, body), apiPost<Incident>(request, "admin", path, body),
    ]);
    expect(first.id).toBe(operationId);
    expect(replay.id).toBe(first.id);
    const persisted = await apiGet<Incident>(request, "admin", `/incidents/${operationId}`);
    expect(persisted.events.filter(({ type }) => type === "INCIDENT_CREATED")).toHaveLength(1);
    expect(await statusOf(request, "admin", "POST", path, { ...body, title: "Payload alterado depois do timeout" })).toBe(409);
    expect(await statusOf(request, "operator", "POST", path, body)).toBe(409);
    expect(await statusOf(request, "viewer", "POST", `/incidents/offline/${randomUUID()}`, body)).toBe(403);
    expect(await statusOf(request, "admin", "POST", `/incidents/offline/${randomUUID()}`, { ...body, title: "x" })).toBe(400);
  });

  test("servidor rejeita versões antigas e permissões insuficientes em despacho e checklist", async ({ request }) => {
    const dispatch = await createDispatch(request);
    const dispatchPath = `/field-teams/dispatches/${dispatch.id}/status`;
    await apiPatch(request, "admin", dispatchPath, { status: "DISPATCHED" });
    expect(await statusOf(request, "admin", "PATCH", dispatchPath, { status: "CANCELLED", reason: "Operação offline obsoleta", expectedStatus: dispatch.status, expectedUpdatedAt: dispatch.updatedAt })).toBe(409);
    expect(await statusOf(request, "viewer", "PATCH", dispatchPath, { status: "CANCELLED", reason: "Usuário sem permissão" })).toBe(403);
    expect((await apiGet<Dispatch>(request, "admin", `/field-teams/dispatches/${dispatch.id}`)).status).toBe("DISPATCHED");

    const checklist = await createChecklist(request);
    const item = checklist.items[0];
    const checklistPath = `/preparation-checklists/items/${item.id}`;
    await apiPatch(request, "admin", checklistPath, { status: "BLOCKED", observation: "Alteração remota preservada" });
    expect(await statusOf(request, "admin", "PATCH", checklistPath, { status: "COMPLETED", expectedStatus: item.status, expectedUpdatedAt: item.updatedAt })).toBe(409);
    expect(await statusOf(request, "viewer", "PATCH", checklistPath, { status: "COMPLETED" })).toBe(403);
    expect((await apiGet<Checklist>(request, "admin", `/preparation-checklists/${checklist.id}`)).items[0]).toMatchObject({ status: "BLOCKED", observation: "Alteração remota preservada" });
  });

  test("troca de usuário não expõe nem envia operação pendente de outra identidade", async ({ page, request }) => {
    await loginAs(page, "admin");
    await prepareIncident(page, request);
    const path = /\/api\/incidents\/offline\//;
    await page.context().setOffline(true);
    await page.getByRole("button", { name: /Guardar na fila local|Salvar incidente/ }).click();
    await expect(queue(page).getByText("Ocorrência · Pendente", { exact: true })).toBeVisible();
    const unavailable = (route: Route) => route.abort("connectionfailed");
    await page.route(path, unavailable);
    await page.context().setOffline(false);
    await logout(page);
    await loginAs(page, "viewer");
    await expect(queue(page).getByText("Nenhuma operação local registrada.")).toBeVisible();
    await logout(page);
    await loginAs(page, "admin");
    await expect(queue(page).getByText("Ocorrência · Pendente", { exact: true })).toBeVisible();
    await page.unroute(path, unavailable);
    await queue(page).getByRole("button", { name: "Sincronizar agora" }).click();
    await expect(queue(page).getByText("Ocorrência · Sincronizada", { exact: true })).toBeVisible();
  });

  test("duas abas sincronizam a mesma operação com apenas uma requisição", async ({ page, context, request }) => {
    await loginAs(page, "admin");
    await prepareIncident(page, request);
    await context.setOffline(true);
    await page.getByRole("button", { name: /Guardar na fila local|Salvar incidente/ }).click();
    await expect(queue(page).getByText("Ocorrência · Pendente", { exact: true })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((done) => { release = done; });
    let requests = 0;
    await context.route(/\/api\/incidents\/offline\//, async (route) => {
      requests += 1;
      await gate;
      await route.continue();
    });
    await context.setOffline(false);
    const second = await context.newPage();
    try {
      await second.goto("/incidents");
      await expect(queue(second)).toBeVisible();
      await expect.poll(() => requests).toBe(1);
      release();
      await expect(queue(page).getByText("Ocorrência · Sincronizada", { exact: true })).toBeVisible();
      await expect(queue(second).getByText("Ocorrência · Sincronizada", { exact: true })).toBeVisible();
      expect(requests).toBe(1);
    } finally {
      release();
      await second.close();
    }
  });

  test("logout em uma aba encerra a identidade da outra sem transmitir sua fila", async ({ page, context, request }) => {
    await loginAs(page, "admin");
    await prepareIncident(page, request);
    await context.setOffline(true);
    await page.getByRole("button", { name: /Guardar na fila local|Salvar incidente/ }).click();
    await expect(queue(page).getByText("Ocorrência · Pendente", { exact: true })).toBeVisible();
    const path = /\/api\/incidents\/offline\//;
    await context.route(path, (route) => route.abort("connectionfailed"));
    await context.setOffline(false);
    const second = await context.newPage();
    try {
      await second.goto("/incidents");
      await expect(queue(second).getByText("Ocorrência · Pendente", { exact: true })).toBeVisible();
      await logout(page);
      await expect(second).toHaveURL(/\/login(?:\?|$)/);
      await expect(queue(second)).toHaveCount(0);
      await loginAs(page, "viewer");
      await expect(queue(page).getByText("Nenhuma operação local registrada.")).toBeVisible();
      await second.reload();
      await expect(queue(second).getByText("Nenhuma operação local registrada.")).toBeVisible();
    } finally {
      await second.close();
    }
  });

  test("permissão revogada antes da reconexão gera falha revisável sem criar incidente", async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const reads = ["elections.read", "incidents.read", "inventory.read"];
    const role = await apiPost<{ id: string }>(request, "admin", "/roles", {
      name: `Campo offline ${suffix}`, key: `OFFLINE_${suffix.toUpperCase()}`, permissionKeys: [...reads, "incidents.create"],
    });
    const email = `offline-${suffix}@eops.local`;
    const password = `Offline-${suffix}!`;
    await apiPost(request, "admin", "/users", { name: "Operador de teste offline", email, password, roleIds: [role.id] });
    const login = await request.post(`${API_BASE}/auth/login`, { data: { email, password } });
    expect(login.ok()).toBeTruthy();
    const session = await login.json() as { token: string };
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    const body = await prepareIncident(page, request);
    await page.context().setOffline(true);
    await page.getByRole("button", { name: /Guardar na fila local|Salvar incidente/ }).click();
    await expect(queue(page).getByText("Ocorrência · Pendente", { exact: true })).toBeVisible();
    const captured = (await capturedEntries(page)).find((entry) => entry.body.title === body.title)!;
    expect(captured).toBeTruthy();
    await apiPatch(request, "admin", `/roles/${role.id}`, { permissionKeys: reads });
    await page.context().setOffline(false);
    await expect(queue(page).getByText("Ocorrência · Revisão necessária", { exact: true })).toBeVisible();
    const denied = await request.post(`${API_BASE}/incidents/offline/${captured.id}`, {
      headers: { Authorization: `Bearer ${session.token}` }, data: captured.body,
    });
    expect(denied.status()).toBe(403);
    const failed = (await capturedEntries(page))[0];
    expect(failed).toMatchObject({ id: captured.id, body: captured.body, state: "failed" });
    await expect(queue(page).getByRole("button", { name: "Sincronizar agora" })).toBeDisabled();
    await page.reload();
    await expect(queue(page).getByText("Ocorrência · Revisão necessária", { exact: true })).toBeVisible();
    expect((await capturedEntries(page))[0].attempts).toBe(failed.attempts);
    const matches = await apiGet<{ items: Incident[] }>(request, "admin", "/incidents", { search: body.title });
    expect(matches.items.filter(({ title }) => title === body.title)).toEqual([]);
  });

  test("resposta perdida com rede ativa preserva UUID e não duplica incidente já gravado", async ({ page, request }) => {
    await loginAs(page, "admin");
    const body = await prepareIncident(page, request);
    const path = /\/api\/incidents\/offline\//;
    let persisted: Incident | undefined;
    await page.route(path, async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      if (!persisted) {
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        persisted = await response.json() as Incident;
      }
      await route.abort("connectionfailed");
    });
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await page.getByRole("button", { name: "Salvar incidente", exact: true }).click();
    await expect(queue(page).getByText("Ocorrência · Pendente", { exact: true })).toBeVisible();
    const captured = (await capturedEntries(page)).find((entry) => entry.body.title === body.title)!;
    expect(captured.id).toBe(persisted?.id);
    expect((await apiGet<Incident>(request, "admin", `/incidents/${captured.id}`)).events.filter(({ type }) => type === "INCIDENT_CREATED")).toHaveLength(1);
    await page.unroute(path);
    await expect(queue(page).getByRole("button", { name: "Sincronizar agora" })).toBeEnabled();
    await queue(page).getByRole("button", { name: "Sincronizar agora" }).click();
    await expect(queue(page).getByText("Ocorrência · Sincronizada", { exact: true })).toBeVisible();
    const confirmed = await apiGet<Incident>(request, "admin", `/incidents/${captured.id}`);
    expect(confirmed.title).toBe(body.title);
    expect(confirmed.events.filter(({ type }) => type === "INCIDENT_CREATED")).toHaveLength(1);
  });

  test("API indisponível com rede ativa guarda despacho e mantém snapshot até sincronizar", async ({ page, request }) => {
    const dispatch = await createDispatch(request);
    await loginAs(page, "admin");
    await page.goto(`/field-teams/dispatch/${dispatch.id}`);
    await page.getByRole("combobox", { name: "Transição", exact: true }).selectOption("DISPATCHED");
    const path = new RegExp(`/api/field-teams/dispatches/${dispatch.id}/status$`);
    await page.route(path, (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 503, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify({ message: "API temporariamente indisponível" }) })
      : route.continue());
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await page.getByRole("button", { name: "Aplicar transição" }).click();
    await expect(queue(page).getByText("Despacho · Pendente", { exact: true })).toBeVisible();
    expect((await capturedEntries(page))[0].body).toMatchObject({ expectedStatus: dispatch.status, expectedUpdatedAt: dispatch.updatedAt });
    expect((await apiGet<Dispatch>(request, "admin", `/field-teams/dispatches/${dispatch.id}`)).status).toBe("REQUESTED");
    await page.unroute(path);
    await expect(queue(page).getByRole("button", { name: "Sincronizar agora" })).toBeEnabled();
    await queue(page).getByRole("button", { name: "Sincronizar agora" }).click();
    await expect(queue(page).getByText("Despacho · Sincronizada", { exact: true })).toBeVisible();
    expect((await apiGet<Dispatch>(request, "admin", `/field-teams/dispatches/${dispatch.id}`)).status).toBe("DISPATCHED");
  });

  test("API indisponível com rede ativa guarda item de checklist sem perder observação", async ({ page, request }) => {
    const checklist = await createChecklist(request);
    await loginAs(page, "admin");
    await page.goto(`/preparation-checklists/${checklist.id}`);
    const item = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Conferir iluminação" }) });
    await item.getByRole("combobox", { name: "Status", exact: true }).selectOption("COMPLETED");
    await item.getByLabel("Observação", { exact: true }).fill("Conferido enquanto a API estava indisponível.");
    const path = new RegExp(`/api/preparation-checklists/items/${checklist.items[0].id}$`);
    await page.route(path, (route) => route.request().method() === "PATCH" ? route.abort("connectionfailed") : route.continue());
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await item.getByRole("button", { name: "Salvar item" }).click();
    await expect(queue(page).getByText("Item de checklist · Pendente", { exact: true })).toBeVisible();
    expect((await capturedEntries(page))[0].body).toMatchObject({ expectedStatus: checklist.items[0].status, expectedUpdatedAt: checklist.items[0].updatedAt });
    expect((await apiGet<Checklist>(request, "admin", `/preparation-checklists/${checklist.id}`)).items[0].status).toBe("PENDING");
    await page.unroute(path);
    await expect(queue(page).getByRole("button", { name: "Sincronizar agora" })).toBeEnabled();
    await queue(page).getByRole("button", { name: "Sincronizar agora" }).click();
    await expect(queue(page).getByText("Item de checklist · Sincronizada", { exact: true })).toBeVisible();
    expect((await apiGet<Checklist>(request, "admin", `/preparation-checklists/${checklist.id}`)).items[0]).toMatchObject({ status: "COMPLETED", observation: "Conferido enquanto a API estava indisponível." });
    await expect(item.getByText(/^Concluído em /)).toBeVisible();
  });

  test("erro HTTP definitivo na criação online permanece visível sem enfileirar", async ({ page, request }) => {
    await loginAs(page, "admin");
    const body = await prepareIncident(page, request);
    await page.route(/\/api\/incidents\/offline\//, (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 403, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify({ message: "Criação não autorizada neste teste de classificação" }) })
      : route.continue());
    await page.getByRole("button", { name: "Salvar incidente", exact: true }).click();
    await expect(page.getByText("Criação não autorizada neste teste de classificação", { exact: true })).toBeVisible();
    expect(await capturedEntries(page)).toEqual([]);
    await expect(queue(page).getByText("Nenhuma operação local registrada.")).toBeVisible();
    const matches = await apiGet<{ items: Incident[] }>(request, "admin", "/incidents", { search: body.title });
    expect(matches.items.filter(({ title }) => title === body.title)).toEqual([]);
  });
});
