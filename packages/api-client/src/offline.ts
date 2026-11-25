import { apiClient, ApiError } from "./index";

export type OfflineAction =
  | { kind: "incident"; body: { title: string; description: string; severity: string; electionId: string; categoryId: string; electoralZoneId?: string; pollingPlaceId?: string; assetId?: string; slaDeadline?: string } }
  | { kind: "dispatch"; resourceId: string; body: { status: string; expectedStatus: string; expectedUpdatedAt: string; reason?: string; summary?: string; memberId?: string; notes?: string } }
  | { kind: "checklist"; resourceId: string; body: { status: string; expectedStatus: string; expectedUpdatedAt: string; assigneeId?: string | null; observation?: string } };

export type OfflineEntry = OfflineAction & { id: string; ownerId: string; createdAt: string; attempts: number; state: "pending" | "syncing" | "failed" | "synced"; error?: string };
const KEY = "eops.offline.v1";
const EVENT = "eops:offline-updated";
let activeOwner: string | undefined;
export function setOfflineOwner(owner?: string) { activeOwner = owner; }
export function currentOfflineOwner() { return activeOwner; }

function stored(): OfflineEntry[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Fila local inválida; os dados originais foram preservados.");
  return parsed as OfflineEntry[];
}

function save(entries: OfflineEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(EVENT));
}

export function offlineEntries(ownerId: string) { return stored().filter((entry) => entry.ownerId === ownerId); }
export function queueOffline(ownerId: string, action: OfflineAction) {
  if (!ownerId) throw new Error("Sessão não identificada.");
  const entry: OfflineEntry = { ...action, id: crypto.randomUUID(), ownerId, createdAt: new Date().toISOString(), attempts: 0, state: "pending" };
  save([...stored(), entry]);
  return entry;
}
export function removeOffline(ownerId: string, id: string) { save(stored().filter((entry) => entry.ownerId !== ownerId || entry.id !== id)); }
export function retryOffline(ownerId: string, id: string) {
  save(stored().map((entry) => entry.ownerId === ownerId && entry.id === id && entry.state === "failed" ? { ...entry, state: "pending", error: undefined } : entry));
}
export function observeOffline(update: () => void) {
  window.addEventListener(EVENT, update);
  window.addEventListener("storage", update);
  return () => { window.removeEventListener(EVENT, update); window.removeEventListener("storage", update); };
}

async function deliver(entry: OfflineEntry) {
  if (entry.kind === "incident") return apiClient.post(`/incidents/offline/${entry.id}`, entry.body);
  if (entry.kind === "dispatch") return apiClient.patch(`/field-teams/dispatches/${entry.resourceId}/status`, entry.body);
  return apiClient.patch(`/preparation-checklists/items/${entry.resourceId}`, entry.body);
}

const running = new Map<string, Promise<void>>();
export function synchronizeOffline(ownerId: string, currentUser: () => string | undefined): Promise<void> {
  if (currentUser() !== ownerId) return Promise.reject(new Error("Sessão diferente da proprietária da fila."));
  const active = running.get(ownerId);
  if (active) return active;
  if (!navigator.locks?.request) return Promise.reject(new Error("Este navegador não oferece exclusão segura entre abas."));
  const task = navigator.locks.request(`eops.offline.${ownerId}`, async () => {
    for (const entry of offlineEntries(ownerId)) {
      if (currentUser() !== ownerId || !navigator.onLine) break;
      if (entry.state === "synced" || entry.state === "failed") continue;
      save(stored().map((item) => item.id === entry.id ? { ...item, state: "syncing", attempts: item.attempts + 1 } : item));
      try {
        await deliver(entry);
        if (currentUser() !== ownerId) return;
        save(stored().map((item) => item.id === entry.id ? { ...item, state: "synced", error: undefined } : item));
      } catch (cause) {
        if (currentUser() !== ownerId) return;
        const transport = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500);
        save(stored().map((item) => item.id === entry.id ? {
          ...item, state: transport && entry.kind === "incident" ? "pending" : "failed",
          error: cause instanceof Error ? cause.message : "Falha na sincronização.",
        } : item));
        if (transport) break;
      }
    }
  });
  running.set(ownerId, task);
  void task.finally(() => { if (running.get(ownerId) === task) running.delete(ownerId); }).catch(() => undefined);
  return task;
}