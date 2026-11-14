import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_DATA_KEY } from "@/lib/api-client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
  avatarUrl?: string | null;
};

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (tokens: { accessToken: string; refreshToken: string }, user: AuthUser) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(readStoredUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem(ACCESS_TOKEN_KEY));

  const login = useCallback((tokens: { accessToken: string; refreshToken: string }, nextUser: AuthUser) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(nextUser));
    setUserState(nextUser);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    setUserState(null);
    setIsAuthenticated(false);
  }, []);

  const setUser = useCallback((next: AuthUser) => {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(next));
    setUserState(next);
  }, []);

  // Sesi berakhir (refresh token gagal) → keluar otomatis.
  useEffect(() => {
    const onLogout = () => {
      setUserState(null);
      setIsAuthenticated(false);
    };
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, user, login, logout, setUser }),
    [isAuthenticated, user, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
