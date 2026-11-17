import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { apiRequest, queryClient } from "./queryClient";

// Token lives in sessionStorage: survives page refresh, cleared when the tab closes.
const TOKEN_KEY = "havona.token";
const USER_KEY = "havona.user";

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

let _globalToken: string | null = readStorage(TOKEN_KEY);
let _onUnauthorized: (() => void) | null = null;

export function getAuthToken(): string | null {
  return _globalToken;
}

export function handleUnauthorized() {
  _onUnauthorized?.();
}

export type Role = "admin" | "dpo" | "teacher" | "staff";

export interface AuthUser {
  id: number;
  schoolId: number;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  createdAt: string;
  isDemo?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  updateToken: (token: string) => void;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function loadUser(): AuthUser | null {
  try {
    const raw = readStorage(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(_globalToken);
  const [user, setUser] = useState<AuthUser | null>(() => (_globalToken ? loadUser() : null));
  const [isLoading, setIsLoading] = useState(false);

  const setAuthState = useCallback((newToken: string | null, newUser: AuthUser | null) => {
    _globalToken = newToken;
    writeStorage(TOKEN_KEY, newToken);
    writeStorage(USER_KEY, newUser ? JSON.stringify(newUser) : null);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    setAuthState(null, null);
    queryClient.clear();
  }, [setAuthState]);

  useEffect(() => {
    _onUnauthorized = logout;
    return () => {
      _onUnauthorized = null;
    };
  }, [logout]);

  // Refresh the user profile on load so role changes are picked up.
  useEffect(() => {
    if (!_globalToken) return;
    apiRequest("GET", "/api/auth/me")
      .then((r) => r.json() as Promise<AuthUser>)
      .then((u: AuthUser) => setAuthState(_globalToken, u))
      .catch(() => undefined);
  }, [setAuthState]);

  const authenticate = useCallback(
    async (path: string, body?: unknown) => {
      setIsLoading(true);
      try {
        const res = await apiRequest("POST", path, body);
        const data = (await res.json()) as { token: string; user: AuthUser };
        queryClient.clear();
        setAuthState(data.token, data.user);
      } finally {
        setIsLoading(false);
      }
    },
    [setAuthState],
  );

  const login = useCallback((email: string, password: string) => authenticate("/api/auth/login", { email, password }), [authenticate]);
  const loginDemo = useCallback(() => authenticate("/api/auth/demo"), [authenticate]);
  const updateToken = useCallback((t: string) => setAuthState(t, user), [setAuthState, user]);
  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, isLoading, login, loginDemo, updateToken, logout, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}
