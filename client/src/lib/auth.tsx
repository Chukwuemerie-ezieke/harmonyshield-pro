import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { apiRequest, queryClient } from "./queryClient";

// Global token store — accessible outside React tree for queryClient interceptor
let _globalToken: string | null = null;

export function getAuthToken(): string | null {
  return _globalToken;
}

export function setGlobalToken(token: string | null) {
  _globalToken = token;
}

export interface AuthUser {
  id: number;
  schoolId: number;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, schoolId?: number) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setAuthState = useCallback((newToken: string | null, newUser: AuthUser | null) => {
    setToken(newToken);
    setUser(newUser);
    _globalToken = newToken;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json();
      setAuthState(data.token, data.user);
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }
  }, [setAuthState]);

  const register = useCallback(async (name: string, email: string, password: string, schoolId?: number) => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        name, email, password, schoolId: schoolId || 1, role: "staff",
      });
      const data = await res.json();
      setAuthState(data.token, data.user);
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }
  }, [setAuthState]);

  const logout = useCallback(async () => {
    // Best-effort server-side revocation before clearing local state. If the
    // call fails (offline, already-expired token, etc.) we still clear the
    // local token so the user is logged out client-side regardless.
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // ignore - local logout proceeds regardless
    } finally {
      setAuthState(null, null);
      queryClient.clear();
    }
  }, [setAuthState]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
