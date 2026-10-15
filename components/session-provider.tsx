"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  USER_KEY,
  appendScore,
  parseUser,
  readRaw,
  writeRaw,
  type SavedScore,
  type SessionUser,
} from "@/lib/session";

interface SessionContextValue {
  user: SessionUser | null;
  login: (user: SessionUser | null) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const notify = () => listeners.forEach((cb) => cb());

const getSnapshot = () => readRaw(USER_KEY);
// Servidor e hidratación: sin sesión, para que el primer render coincida.
const getServerSnapshot = () => null;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = useMemo(() => parseUser(raw), [raw]);

  const login = useCallback((u: SessionUser | null) => {
    writeRaw(USER_KEY, u ? JSON.stringify(u) : null);
    notify();
  }, []);
  const signOut = useCallback(() => login(null), [login]);

  const value = useMemo(
    () => ({ user, login, signOut, saveScore: appendScore }),
    [user, login, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
