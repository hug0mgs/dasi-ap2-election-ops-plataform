import { apiClient, ApiError } from "./index";

export type OfflineAction =
  | { kind: "incident"; body: { title: string; description: string; severity: string; electionId: string; categoryId: string; electoralZoneId?: string; pollingPlaceId?: string; assetId?: string; slaDeadline?: string } }
  | { kind: "dispatch"; resourceId: string; body: { status: string; expectedStatus: string; expectedUpdatedAt: string; reason?: string; summary?: string; memberId?: string; notes?: string } }
  | { kind: "checklist"; resourceId: string; body: { status: string; expectedStatus: string; expectedUpdatedAt: string; assigneeId?: string | null; observation?: string } };

export type OfflineEntry = OfflineAction & { id: string; ownerId: string; createdAt: string; attempts: number; state: "pending" | "syncing" | "failed" | "synced"; error?: string };
const KEY = "eops.offline.v1";
const ENTRY_KEY = `${KEY}.entry.`;
const EVENT = "eops:offline-updated";
let activeOwner: string | undefined;
let ownerRevision = 0;
export function setOfflineOwner(owner?: string) { activeOwner = owner; ownerRevision += 1; }
export function currentOfflineOwner() { return activeOwner; }

function validEntry(value: unknown): value is OfflineEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<OfflineEntry>;
  return typeof item.id === "string" && typeof item.ownerId === "string" &&
    typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.attempts === "number" && item.attempts >= 0 &&
    ["pending", "syncing", "failed", "synced"].includes(item.state ?? "") &&
    ["incident", "dispatch", "checklist"].includes(item.kind ?? "") &&
    Boolean(item.body && typeof item.body === "object") &&
    (item.kind === "incident" || ("resourceId" in item && typeof item.resourceId === "string"));
}

function stored(): OfflineEntry[] {
  const raw = localStorage.getItem(KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed) || !parsed.every(validEntry)) throw new Error("Fila local inválida; os dados originais foram preservados.");
  // A versão anterior permanece intacta; cada alteração sobrepõe apenas sua operação.
  const entries = new Map<string, OfflineEntry>(parsed.map((entry) => [entry.id, entry]));
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(ENTRY_KEY)) continue;
    const value = localStorage.getItem(key);
    if (value === null) continue;
    const entry: unknown = JSON.parse(value);
    const id = key.slice(ENTRY_KEY.length);
    if (entry === null) entries.delete(id);
    else if (validEntry(entry) && entry.id === id) entries.set(id, entry);
    else throw new Error("Fila local inválida; os dados originais foram preservados.");
  }
  return [...entries.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function saveEntry(entry: OfflineEntry) {
  localStorage.setItem(`${ENTRY_KEY}${entry.id}`, JSON.stringify(entry));
  window.dispatchEvent(new Event(EVENT));
}

function updateEntry(ownerId: string, id: string, change: (entry: OfflineEntry) => OfflineEntry) {
  const entry = offlineEntries(ownerId).find((item) => item.id === id);
  if (entry) saveEntry(change(entry));
}

export function offlineEntries(ownerId: string) { return stored().filter((entry) => entry.ownerId === ownerId); }
export function queueOffline(ownerId: string, action: OfflineAction, operationId?: string) {
  if (!ownerId) throw new Error("Sessão não identificada.");
  const id = operationId ?? crypto.randomUUID();
  const existing = stored().find((entry) => entry.id === id);
  if (existing) {
    if (existing.ownerId !== ownerId || existing.kind !== action.kind ||
      JSON.stringify(existing.body) !== JSON.stringify(action.body) ||
      (action.kind !== "incident" && (existing.kind === "incident" || existing.resourceId !== action.resourceId))) {
      throw new Error("Esta operação local já pertence a outro usuário ou conteúdo.");
    }
    return existing;
  }
  if (localStorage.getItem(`${ENTRY_KEY}${id}`) === "null") throw new Error("Esta operação local já foi descartada.");
  const entry: OfflineEntry = { ...action, id, ownerId, createdAt: new Date().toISOString(), attempts: 0, state: "pending" };
  saveEntry(entry);
  return entry;
}
export function removeOffline(ownerId: string, id: string) {
  const entries = offlineEntries(ownerId);
  const legacy = localStorage.getItem(KEY);
  const original = legacy ? JSON.parse(legacy) as OfflineEntry[] : [];
  const entry = entries.find((item) => item.id === id) ?? original.find((item) => item.id === id && item.ownerId === ownerId);
  if (!entry) return;
  if (entry.state === "syncing") throw new Error("Aguarde a confirmação antes de descartar uma operação em sincronização.");
  localStorage.setItem(`${ENTRY_KEY}${id}`, "null");
  if (legacy) {
    const remaining = (JSON.parse(legacy) as OfflineEntry[]).filter((item) => localStorage.getItem(`${ENTRY_KEY}${item.id}`) !== "null");
    localStorage.setItem(KEY, JSON.stringify(remaining));
  }
  window.dispatchEvent(new Event(EVENT));
}
export function retryOffline(ownerId: string, id: string) {
  updateEntry(ownerId, id, (entry) => entry.state === "failed" ? { ...entry, state: "pending", error: undefined } : entry);
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
  const revision = ownerRevision;
  const ownsSession = () => currentUser() === ownerId && revision === ownerRevision;
  const task = navigator.locks.request(`eops.offline.${ownerId}`, async () => {
    const blocked = new Set<string>();
    for (const captured of offlineEntries(ownerId)) {
      if (!ownsSession() || !navigator.onLine) break;
      const entry = offlineEntries(ownerId).find((item) => item.id === captured.id);
      if (!entry || entry.state === "synced") continue;
      const resource = entry.kind === "incident" ? entry.id : `${entry.kind}:${entry.resourceId}`;
      if (entry.state === "failed") { blocked.add(resource); continue; }
      if (blocked.has(resource)) continue;
      updateEntry(ownerId, entry.id, (item) => ({ ...item, state: "syncing", attempts: item.attempts + 1 }));
      try {
        await deliver(entry);
      } catch (cause) {
        if (!ownsSession()) return;
        const transport = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500);
        updateEntry(ownerId, entry.id, (item) => ({
          ...item, state: transport ? "pending" : "failed",
          error: cause instanceof Error ? cause.message : "Falha na sincronização.",
        }));
        if (transport) break;
        blocked.add(resource);
        continue;
      }
      if (!ownsSession()) return;
      updateEntry(ownerId, entry.id, (item) => ({ ...item, state: "synced", error: undefined }));
    }
  });
  running.set(ownerId, task);
  void task.finally(() => { if (running.get(ownerId) === task) running.delete(ownerId); }).catch(() => undefined);
  return task;
}
