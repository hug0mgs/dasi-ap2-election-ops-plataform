import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentOfflineOwner, offlineEntries, queueOffline, removeOffline, retryOffline, setOfflineOwner, synchronizeOffline } from "./offline";

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("Event", class { constructor(public type: string) {} });
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("11111111-1111-4111-8111-111111111111").mockReturnValueOnce("22222222-2222-4222-8222-222222222222") });
  vi.stubGlobal("navigator", { onLine: true, locks: { request: (_: string, action: () => Promise<void>) => action() } });
  setOfflineOwner();
});

describe("fila offline", () => {
  it("persiste por identidade e não mistura filas", () => {
    queueOffline("user-1", { kind: "incident", body: { title: "Teste", description: "Teste", severity: "HIGH", electionId: "e-1", categoryId: "c-1" } });
    expect(offlineEntries("user-1")).toHaveLength(1);
    expect(offlineEntries("user-2")).toEqual([]);
    removeOffline("user-2", "11111111-1111-4111-8111-111111111111");
    expect(offlineEntries("user-1")).toHaveLength(1);
  });

  it("não envia fila de outra identidade", async () => {
    setOfflineOwner("user-2");
    expect(currentOfflineOwner()).toBe("user-2");
    await expect(synchronizeOffline("user-1", currentOfflineOwner)).rejects.toThrow("Sessão diferente");
  });

  it("não apaga uma falha sem descarte explícito", () => {
    const entry = queueOffline("user-1", { kind: "checklist", resourceId: "item-1", body: { status: "COMPLETED", expectedStatus: "PENDING", expectedUpdatedAt: "2026-11-17T10:00:00.000Z" } });
    retryOffline("user-1", entry.id);
    expect(offlineEntries("user-1")[0].state).toBe("pending");
  });
});