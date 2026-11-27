import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "./index";
import { currentOfflineOwner, offlineEntries, queueOffline, removeOffline, retryOffline, setOfflineOwner, synchronizeOffline, type OfflineAction } from "./offline";

const values = new Map<string, string>();
const storage = {
  get length() { return values.size; },
  key: (index: number) => [...values.keys()][index] ?? null,
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  removeItem: vi.fn((key: string) => { values.delete(key); }),
};
const incident = (): Extract<OfflineAction, { kind: "incident" }> => ({ kind: "incident", body: { title: "Falha de energia", description: "Registro capturado em campo", severity: "HIGH", electionId: "e-1", categoryId: "c-1" } });
const dispatch = (resourceId = "dispatch-1"): OfflineAction => ({ kind: "dispatch", resourceId, body: { status: "DISPATCHED", expectedStatus: "REQUESTED", expectedUpdatedAt: "2026-11-17T10:00:00.000Z" } });
const checklist = (resourceId = "item-1"): OfflineAction => ({ kind: "checklist", resourceId, body: { status: "COMPLETED", expectedStatus: "PENDING", expectedUpdatedAt: "2026-11-17T10:00:00.000Z", observation: "Conferido no local" } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.restoreAllMocks();
  values.clear();
  storage.getItem.mockClear();
  storage.setItem.mockClear();
  storage.removeItem.mockClear();
  let sequence = 0;
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("crypto", { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` });
  vi.stubGlobal("navigator", { onLine: true, locks: { request: vi.fn((_name: string, action: () => Promise<void>) => Promise.resolve().then(action)) } });
  vi.spyOn(apiClient, "post").mockResolvedValue({});
  vi.spyOn(apiClient, "patch").mockResolvedValue({});
  setOfflineOwner("user-1");
});

afterEach(() => { setOfflineOwner(); vi.unstubAllGlobals(); });

describe("persistência e isolamento da fila offline", () => {
  it("reutiliza o identificador capturado sem reiniciar estado ou tentativas", async () => {
    const operationId = "11111111-1111-4111-8111-111111111111";
    const action = incident();
    queueOffline("user-1", action, operationId);
    vi.mocked(apiClient.post).mockRejectedValueOnce(new ApiError(503, "Resposta indisponível"));
    await synchronizeOffline("user-1", currentOfflineOwner);
    const original = offlineEntries("user-1")[0];
    expect(queueOffline("user-1", action, operationId)).toEqual(original);
    expect(offlineEntries("user-1")).toHaveLength(1);
    expect(original).toMatchObject({ id: operationId, state: "pending", attempts: 1 });
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(vi.mocked(apiClient.post).mock.calls.map(([path]) => path)).toEqual([
      `/incidents/offline/${operationId}`, `/incidents/offline/${operationId}`,
    ]);
  });

  it("recusa colisão de identificador com outra identidade ou conteúdo sem sobrescrever", () => {
    const operationId = "11111111-1111-4111-8111-111111111111";
    const original = queueOffline("user-1", incident(), operationId);
    expect(() => queueOffline("user-2", incident(), operationId)).toThrow("outro usuário ou conteúdo");
    const changed = incident();
    changed.body.title = "Outro conteúdo";
    expect(() => queueOffline("user-1", changed, operationId)).toThrow("outro usuário ou conteúdo");
    expect(() => queueOffline("user-1", checklist(), operationId)).toThrow("outro usuário ou conteúdo");
    expect(offlineEntries("user-1")).toEqual([original]);
  });

  it("recusa colisão de recurso e reaproveitamento de identificador descartado", () => {
    const operationId = "11111111-1111-4111-8111-111111111111";
    queueOffline("user-1", dispatch("dispatch-1"), operationId);
    expect(() => queueOffline("user-1", dispatch("dispatch-2"), operationId)).toThrow("outro usuário ou conteúdo");
    removeOffline("user-1", operationId);
    expect(() => queueOffline("user-1", dispatch("dispatch-1"), operationId)).toThrow("já foi descartada");
    expect(offlineEntries("user-1")).toEqual([]);
  });

  it("persiste a operação e impede descarte por outra identidade", () => {
    const entry = queueOffline("user-1", incident());
    expect(offlineEntries("user-1")).toEqual([expect.objectContaining({ ...entry, state: "pending", attempts: 0 })]);
    expect(offlineEntries("user-2")).toEqual([]);
    removeOffline("user-2", entry.id);
    expect(offlineEntries("user-1")).toHaveLength(1);
    removeOffline("user-1", entry.id);
    expect(offlineEntries("user-1")).toEqual([]);
  });

  it("não confirma captura quando o armazenamento recusa a gravação", () => {
    storage.setItem.mockImplementationOnce(() => { throw new Error("Quota excedida"); });
    expect(() => queueOffline("user-1", incident())).toThrow("Quota excedida");
    expect(offlineEntries("user-1")).toEqual([]);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("lê a fila legada e remove seu payload quando o dono descarta", () => {
    const entry = { ...incident(), id: "legacy-1", ownerId: "user-1", createdAt: "2026-11-17T10:00:00.000Z", attempts: 0, state: "pending" };
    values.set("eops.offline.v1", JSON.stringify([entry]));
    expect(offlineEntries("user-1")).toEqual([entry]);
    removeOffline("user-2", entry.id);
    expect(values.get("eops.offline.v1")).toContain(entry.id);
    removeOffline("user-1", entry.id);
    expect(offlineEntries("user-1")).toEqual([]);
    expect(values.get("eops.offline.v1") ?? "").not.toContain(entry.id);
  });

  it.each(["{inválido", '{"entries":[]}', '[null]'])("preserva a fila antiga corrompida sem sobrescrever: %s", (raw) => {
    values.set("eops.offline.v1", raw);
    expect(() => queueOffline("user-1", incident())).toThrow();
    expect(values.get("eops.offline.v1")).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("recusa sincronizar fila pertencente a outra sessão", async () => {
    queueOffline("user-1", incident());
    setOfflineOwner("user-2");
    expect(currentOfflineOwner()).toBe("user-2");
    await expect(synchronizeOffline("user-1", currentOfflineOwner)).rejects.toThrow("Sessão diferente");
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("mantém operações sem tentativa enquanto o navegador está desconectado", async () => {
    queueOffline("user-1", incident());
    Object.defineProperty(navigator, "onLine", { value: false });
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(offlineEntries("user-1")[0]).toMatchObject({ state: "pending", attempts: 0 });
  });
});

describe("entrega e tratamento dos resultados", () => {
  const deliveries = [
    { name: "incidente", action: incident, method: "post", path: "/incidents/offline/00000000-0000-4000-8000-000000000001" },
    { name: "despacho", action: dispatch, method: "patch", path: "/field-teams/dispatches/dispatch-1/status" },
    { name: "checklist", action: checklist, method: "patch", path: "/preparation-checklists/items/item-1" },
  ] as const;
  for (const delivery of deliveries) {
    it(`entrega ${delivery.name} pela API pública e confirma somente após resposta`, async () => {
      const entry = queueOffline("user-1", delivery.action());
      const response = deferred<object>();
      vi.mocked(apiClient[delivery.method]).mockReturnValueOnce(response.promise);
      const sync = synchronizeOffline("user-1", currentOfflineOwner);
      await vi.waitFor(() => expect(apiClient[delivery.method]).toHaveBeenCalledTimes(1));
      expect(offlineEntries("user-1")[0]).toMatchObject({ state: "syncing", attempts: 1 });
      expect(vi.mocked(apiClient[delivery.method]).mock.calls[0].slice(0, 2)).toEqual([delivery.path, entry.body]);
      response.resolve({});
      await sync;
      expect(offlineEntries("user-1")[0]).toMatchObject({ id: entry.id, state: "synced", attempts: 1 });
      await synchronizeOffline("user-1", currentOfflineOwner);
      expect(apiClient[delivery.method]).toHaveBeenCalledTimes(1);
    });

    it.each([0, 503])(`mantém ${delivery.name} pendente após falha transitória HTTP %i`, async (status) => {
      const entry = queueOffline("user-1", delivery.action());
      vi.mocked(apiClient[delivery.method]).mockRejectedValueOnce(new ApiError(status, "API indisponível"));
      await synchronizeOffline("user-1", currentOfflineOwner);
      expect(offlineEntries("user-1")[0]).toMatchObject({ id: entry.id, body: entry.body, state: "pending", attempts: 1, error: "API indisponível" });
      await synchronizeOffline("user-1", currentOfflineOwner);
      expect(offlineEntries("user-1")[0]).toMatchObject({ id: entry.id, state: "synced", attempts: 2 });
    });
  }

  it.each([400, 401, 403, 409])("preserva payload e exige decisão explícita após HTTP %i", async (status) => {
    const entry = queueOffline("user-1", checklist());
    vi.mocked(apiClient.patch).mockRejectedValueOnce(new ApiError(status, "Revisão necessária"));
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(offlineEntries("user-1")[0]).toMatchObject({ body: entry.body, state: "failed", attempts: 1, error: "Revisão necessária" });
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    retryOffline("user-2", entry.id);
    expect(offlineEntries("user-1")[0].state).toBe("failed");
    retryOffline("user-1", entry.id);
    expect(offlineEntries("user-1")[0]).toMatchObject({ body: entry.body, state: "pending" });
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(offlineEntries("user-1")[0].state).toBe("synced");
  });

  it("interrompe o ciclo após falha de transporte sem perder operações seguintes", async () => {
    queueOffline("user-1", dispatch());
    queueOffline("user-1", incident());
    vi.mocked(apiClient.patch).mockRejectedValueOnce(new ApiError(0, "Sem rede"));
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(offlineEntries("user-1").map(({ state, attempts }) => ({ state, attempts }))).toEqual([{ state: "pending", attempts: 1 }, { state: "pending", attempts: 0 }]);
  });

  it("não ultrapassa falha no mesmo recurso, mas sincroniza recurso independente", async () => {
    const first = queueOffline("user-1", dispatch());
    const blocked = queueOffline("user-1", dispatch());
    const independent = queueOffline("user-1", dispatch("dispatch-2"));
    vi.mocked(apiClient.patch).mockRejectedValueOnce(new ApiError(409, "Versão alterada"));
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(offlineEntries("user-1")).toEqual([
      expect.objectContaining({ id: first.id, state: "failed", attempts: 1 }),
      expect.objectContaining({ id: blocked.id, state: "pending", attempts: 0 }),
      expect.objectContaining({ id: independent.id, state: "synced", attempts: 1 }),
    ]);
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    removeOffline("user-1", first.id);
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(offlineEntries("user-1").find(({ id }) => id === blocked.id)?.state).toBe("synced");
  });

  it("não envia operação descartada enquanto a anterior aguardava resposta", async () => {
    queueOffline("user-1", incident());
    const removed = queueOffline("user-1", checklist());
    const response = deferred<object>();
    vi.mocked(apiClient.post).mockReturnValueOnce(response.promise);
    const sync = synchronizeOffline("user-1", currentOfflineOwner);
    await vi.waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    removeOffline("user-1", removed.id);
    response.resolve({});
    await sync;
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(offlineEntries("user-1")).toHaveLength(1);
  });
});

describe("concorrência e retomada", () => {
  it("reutiliza sincronização ativa e solicita exclusão entre abas", async () => {
    queueOffline("user-1", incident());
    const response = deferred<object>();
    vi.mocked(apiClient.post).mockReturnValueOnce(response.promise);
    const first = synchronizeOffline("user-1", currentOfflineOwner);
    expect(synchronizeOffline("user-1", currentOfflineOwner)).toBe(first);
    await vi.waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(navigator.locks.request).toHaveBeenCalledTimes(1);
    response.resolve({});
    await first;
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("recusa envio sem exclusão segura entre abas", async () => {
    queueOffline("user-1", incident());
    Object.defineProperty(navigator, "locks", { value: undefined });
    await expect(synchronizeOffline("user-1", currentOfflineOwner)).rejects.toThrow();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(offlineEntries("user-1")[0]).toMatchObject({ state: "pending", attempts: 0 });
  });

  it("revalida identidade depois de aguardar lock de outra aba", async () => {
    queueOffline("user-1", incident());
    const lock = deferred<void>();
    vi.mocked(navigator.locks.request).mockImplementationOnce(((_name: string, action: () => Promise<void>) => lock.promise.then(action)) as typeof navigator.locks.request);
    const sync = synchronizeOffline("user-1", currentOfflineOwner);
    setOfflineOwner("user-2");
    lock.resolve();
    await sync;
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each(["logout", "outro usuário", "reautenticação"])("para sincronização iniciada antes de %s", async (change) => {
    queueOffline("user-1", incident());
    queueOffline("user-1", checklist());
    const response = deferred<object>();
    vi.mocked(apiClient.post).mockReturnValueOnce(response.promise);
    const sync = synchronizeOffline("user-1", currentOfflineOwner);
    await vi.waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    setOfflineOwner(change === "outro usuário" ? "user-2" : undefined);
    if (change === "reautenticação") setOfflineOwner("user-1");
    response.resolve({});
    await sync;
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(offlineEntries("user-1").filter(({ state }) => state === "synced")).toEqual([]);
  });

  it("retoma operação interrompida pelo logout usando a mesma chave idempotente", async () => {
    const entry = queueOffline("user-1", incident());
    const response = deferred<object>();
    vi.mocked(apiClient.post).mockReturnValueOnce(response.promise);
    const sync = synchronizeOffline("user-1", currentOfflineOwner);
    await vi.waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    setOfflineOwner();
    response.resolve({});
    await sync;
    setOfflineOwner("user-1");
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(vi.mocked(apiClient.post).mock.calls.map(([path]) => path)).toEqual([`/incidents/offline/${entry.id}`, `/incidents/offline/${entry.id}`]);
    expect(offlineEntries("user-1")[0]).toMatchObject({ id: entry.id, state: "synced", attempts: 2 });
  });

  it("não envia se falha a persistência do estado em sincronização", async () => {
    queueOffline("user-1", incident());
    storage.setItem.mockImplementationOnce(() => { throw new Error("Disco indisponível"); });
    await expect(synchronizeOffline("user-1", currentOfflineOwner)).rejects.toThrow("Disco indisponível");
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(offlineEntries("user-1")[0].state).toBe("pending");
  });

  it("mantém confirmação não persistida recuperável sem inventar falha HTTP", async () => {
    queueOffline("user-1", incident());
    vi.mocked(apiClient.post).mockImplementationOnce(async () => {
      storage.setItem.mockImplementationOnce(() => { throw new Error("Quota após resposta"); });
      return {};
    });
    await expect(synchronizeOffline("user-1", currentOfflineOwner)).rejects.toThrow("Quota após resposta");
    expect(offlineEntries("user-1")[0]).toMatchObject({ state: "syncing", attempts: 1 });
    await synchronizeOffline("user-1", currentOfflineOwner);
    expect(offlineEntries("user-1")[0]).toMatchObject({ state: "synced", attempts: 2 });
  });
});
