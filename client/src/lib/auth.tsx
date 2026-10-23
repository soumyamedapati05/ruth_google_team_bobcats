import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";
import type { Me } from "../../../shared/types";

type Auth = { me: Me | null; loading: boolean; setMe: (m: Me | null) => void; signOut: () => Promise<void> };
const Ctx = createContext<Auth>({ me: null, loading: true, setMe: () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.me().then(r => setMe(r.me)).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const h = () => setMe(null);
    window.addEventListener("myopps:signout", h);
    return () => window.removeEventListener("myopps:signout", h);
  }, []);

  const signOut = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setToken(null); setMe(null);
    try { localStorage.removeItem("myopps.results"); } catch { /* ignore */ }
  };
  return <Ctx.Provider value={{ me, loading, setMe, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
