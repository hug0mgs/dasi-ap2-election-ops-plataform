import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { currentOfflineOwner, offlineEntries, observeOffline, removeOffline, retryOffline, synchronizeOffline, type OfflineEntry } from "@eops/api-client/offline";
import styles from "./offlineQueue.module.css";

const names: Record<OfflineEntry["kind"], string> = { incident: "Ocorrência", dispatch: "Despacho", checklist: "Item de checklist" };
const states: Record<OfflineEntry["state"], string> = { pending: "Pendente", syncing: "Sincronizando", failed: "Revisão necessária", synced: "Sincronizada" };

export function OfflineQueue({ userId }: { userId: string }) {
  const [items, setItems] = useState<OfflineEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => { try { setItems(offlineEntries(userId)); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Fila indisponível."); } };
    refresh();
    return observeOffline(refresh);
  }, [userId]);
  const pending = items.filter((item) => item.state === "pending" || item.state === "syncing").length;
  async function sync() {
    setBusy(true);
    try { await synchronizeOffline(userId, currentOfflineOwner); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível sincronizar."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const online = () => { void sync(); };
    window.addEventListener("online", online);
    if (navigator.onLine && pending > 0) void sync();
    return () => window.removeEventListener("online", online);
  }, [userId, pending]);
  return <section className={styles.panel} aria-label="Fila de campo sem conexão">
    <header><div><h2>Fila de campo <span>{pending}</span></h2><p>Dados pendentes ficam neste dispositivo. A confirmação ocorre somente após resposta da API.</p></div>
      <button type="button" disabled={busy || !navigator.onLine || !pending} onClick={() => void sync()}>Sincronizar agora</button></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!navigator.onLine && <p role="status">Sem conexão. As operações permanecerão pendentes neste navegador.</p>}
    {items.length === 0 ? <p>Nenhuma operação local registrada.</p> : <ol className={styles.list}>{items.map((item) => <li key={item.id}>
      <strong>{names[item.kind]} · {states[item.state]}</strong>
      <small>{new Date(item.createdAt).toLocaleString("pt-BR")} · {item.attempts} tentativa(s)</small>
      {item.error && <p role="alert">{item.error}</p>}
      {item.kind !== "incident" && <Link to={item.kind === "dispatch" ? `/field-teams/dispatch/${item.resourceId}` : "/preparation-checklists/list"}>Ver registro</Link>}
      {item.state === "failed" && <button type="button" onClick={() => retryOffline(userId, item.id)}>Revisar e tentar novamente</button>}
      <button type="button" disabled={item.state === "syncing"} onClick={() => removeOffline(userId, item.id)}>Descartar deste dispositivo</button>
    </li>)}</ol>}
  </section>;
}