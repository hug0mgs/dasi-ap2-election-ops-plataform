import { configureApiToken } from "@eops/api-client";
import { setOfflineOwner } from "@eops/api-client/offline";
import type { CurrentUser } from "@eops/shared/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authService } from "./services/authService";

interface AuthValue { user: CurrentUser | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; hasPermission: (permission: string) => boolean; }
const AuthContext = createContext<AuthValue | null>(null);
const TOKEN_KEY = "eops.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const clearSession = () => { setOfflineOwner(); configureApiToken(); setUser(null); setLoading(false); };
    const changed = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === null) { active = false; clearSession(); }
    };
    window.addEventListener("storage", changed);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) clearSession();
    else {
      configureApiToken(token);
      void authService.me().then((current) => {
        if (active && localStorage.getItem(TOKEN_KEY) === token) { setOfflineOwner(current.id); setUser(current); }
      }).catch(() => {
        if (active && localStorage.getItem(TOKEN_KEY) === token) { localStorage.removeItem(TOKEN_KEY); clearSession(); }
      }).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; window.removeEventListener("storage", changed); };
  }, []);
  async function login(email: string, password: string) { const result = await authService.login(email, password); localStorage.setItem(TOKEN_KEY, result.token); configureApiToken(result.token); setOfflineOwner(result.user.id); setUser(result.user); }
  async function logout() {
    setOfflineOwner();
    const request = authService.logout();
    configureApiToken();
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    await request;
  }
  return <AuthContext.Provider value={{ user, loading, login, logout, hasPermission: (permission) => Boolean(user?.permissions.includes(permission)) }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider."); return value; }
